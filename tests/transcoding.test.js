const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const { transcodeToHLS, ffmpegPath } = require('../src/worker-process');

describe('Transcoding Pipeline', () => {
  let spawnStub;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thevault-transcoding-'));
    spawnStub = jest.spyOn(child_process, 'spawn');
  });

  afterEach(() => {
    spawnStub.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function successfulProcess() {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    setImmediate(() => proc.emit('close', 0));
    return proc;
  }

  it('uses the resolved FFmpeg executable for one two-rendition process', async () => {
    spawnStub.mockImplementation(successfulProcess);
    const resolutions = [
      { res: '1280:720', bitrate: '2500k' },
      { res: '1920:1080', bitrate: '5000k' }
    ];

    await transcodeToHLS('any-file.mp4', tempDir, resolutions);

    expect(fs.existsSync(ffmpegPath)).toBe(true);
    expect(spawnStub).toHaveBeenCalledTimes(1);
    expect(spawnStub).toHaveBeenCalledWith(ffmpegPath, expect.any(Array));

    const args = spawnStub.mock.calls[0][1];
    expect(args.filter(arg => arg === '-i')).toHaveLength(1);
    expect(args).toContain(path.join(tempDir, '720p', 'playlist.m3u8'));
    expect(args).toContain(path.join(tempDir, '1080p', 'playlist.m3u8'));
    expect(args.filter(arg => arg === 'h264_nvenc')).toHaveLength(2);
    expect(args.filter(arg => arg === '0:a?')).toHaveLength(2);
  });

  it('rejects when the FFmpeg process cannot be spawned', async () => {
    spawnStub.mockImplementation(() => {
      const proc = new EventEmitter();
      proc.stderr = new EventEmitter();
      setImmediate(() => proc.emit('error', new Error('spawn failed')));
      return proc;
    });

    await expect(transcodeToHLS('any-file.mp4', tempDir, [
      { res: '1280:720', bitrate: '2500k' }
    ])).rejects.toThrow('spawn failed');
  });
});
