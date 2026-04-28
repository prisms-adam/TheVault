const { Worker } = require('bullmq');
const Redis = require('ioredis');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const ffmpegPath = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : require('ffmpeg-static');
const ffprobePath = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : require('ffprobe-static').path;
const prisma = require('./db');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log(`[WORKER] Using FFmpeg: ${ffmpegPath}`);
console.log(`[WORKER] Using FFprobe: ${ffprobePath}`);

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const { getUploadDir } = require('./config');

const worker = new Worker('video-processing', async (job) => {
  const { videoId, filePath } = job.data;
  const baseUploadDir = await getUploadDir();
  const outputDir = path.join(baseUploadDir, videoId);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 1. Get Technical Metadata
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const technicalMetadata = JSON.stringify({
      format: metadata.format.format_name,
      duration: metadata.format.duration,
      size: metadata.format.size,
      bitrate: metadata.format.bit_rate,
      streams: metadata.streams.map(s => ({
        codec_type: s.codec_type,
        codec_name: s.codec_name,
        width: s.width,
        height: s.height,
        r_frame_rate: s.r_frame_rate
      }))
    });

    // 2. Generate Thumbnail
    const thumbnailName = 'thumbnail.png';
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: ['2%'],
          filename: thumbnailName,
          folder: outputDir,
          size: '640x360'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 3. Transcode to HLS (Multi-bitrate)
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
    
    console.log(`[WORKER] Starting parallel hardware-accelerated transcode for ${videoId}...`);
    try {
      await Promise.all([
        transcodeToHLS(filePath, path.join(outputDir, '720p'), '1280:720', '2500k'),
        transcodeToHLS(filePath, path.join(outputDir, '1080p'), '1920:1080', '5000k')
      ]);
    } catch (err) {
      console.error("[PARALLEL TRANSCODE ERROR]:", err);
      throw err;
    }

    // Create Master Playlist
    const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8`;

    fs.writeFileSync(masterPlaylistPath, masterPlaylistContent);

    // 4. Update Database
    const metadataObj = JSON.parse(technicalMetadata);
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'PUBLIC',
        hlsPath: `/${baseUploadDir}/${videoId}/master.m3u8`,
        thumbnailPath: `/${baseUploadDir}/${videoId}/thumbnail.png`,
        technicalMetadata,
        duration: metadataObj.duration || 0,
      },
    });

    // 5. Cleanup temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted temp file: ${filePath}`);
    }

    console.log(`Finished processing video: ${videoId}`);

  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'ERROR' },
    });
    throw error;
  }
}, { connection });

async function transcodeToHLS(input, outputFolder, resolution, bitrate) {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  // Ensure directory is writable
  fs.chmodSync(outputFolder, 0o755);

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        '-hwaccel cuda',
        '-hwaccel_output_format cuda',
        '-c:v h264_nvenc',
        `-vf scale_cuda=${resolution},format=yuv420p`,
        `-b:v ${bitrate}`,
        '-preset p7',
        '-tune hq',
        '-rc vbr',
        '-cq 20',
        '-hls_time 10',
        '-hls_list_size 0',
        `-hls_segment_filename ${path.join(outputFolder, 'seg_%03d.ts')}`
      ])
      .output(path.join(outputFolder, 'playlist.m3u8'))
      .format('hls')
      .on('start', (cmd) => console.log(`[NVENC COMMAND]: ${cmd}`))
      .on('end', resolve)
      .on('error', (err) => {
        console.error(`[NVENC ERROR]: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

console.log('Video worker started...');
