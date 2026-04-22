const { Worker } = require('bullmq');
const Redis = require('ioredis');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');
const prisma = require('./db');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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
    
    // 720p
    await transcodeToHLS(filePath, path.join(outputDir, '720p'), '1280x720', '2500k');
    // 1080p
    await transcodeToHLS(filePath, path.join(outputDir, '1080p'), '1920x1080', '5000k');

    // Create Master Playlist
    const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8`;

    fs.writeFileSync(masterPlaylistPath, masterPlaylistContent);

    // 4. Update Database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'PUBLIC',
        hlsPath: `/vault/${baseUploadDir}/${videoId}/master.m3u8`,
        thumbnailPath: `/vault/${baseUploadDir}/${videoId}/thumbnail.png`,
        technicalMetadata,
      },
    });

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

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .size(resolution)
      .videoBitrate(bitrate)
      .addOption('-hls_time', 10)
      .addOption('-hls_list_size', 0)
      .addOption('-hls_segment_filename', path.join(outputFolder, 'seg_%03d.ts'))
      .format('hls')
      .save(path.join(outputFolder, 'playlist.m3u8'))
      .on('end', resolve)
      .on('error', reject);
  });
}

console.log('Video worker started...');
