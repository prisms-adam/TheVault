const { expect } = require('chai');
const sinon = require('sinon');
const child_process = require('child_process');
const { transcodeToHLS } = require('../src/worker-process'); // Assuming refactor allows export

describe('Transcoding Pipeline', () => {
  let spawnStub;

  beforeEach(() => {
    spawnStub = sinon.stub(child_process, 'spawn');
  });

  afterEach(() => {
    spawnStub.restore();
  });

  it('should spawn exactly one ffmpeg process for multiple resolutions', async () => {
    // Mock successful process execution
    const mockProc = {
      stderr: { on: sinon.stub() },
      on: sinon.stub()
    };
    
    // Simulate 'close' event asynchronously
    mockProc.on.withArgs('close').callsFake((event, callback) => {
      setImmediate(() => callback(0));
    });

    spawnStub.returns(mockProc);

    const resolutions = [
      { res: '1920:1080', bitrate: '5000k' },
      { res: '1280:720', bitrate: '2500k' }
    ];
    
    await transcodeToHLS('any-file.mp4', 'output', resolutions);

    expect(spawnStub.calledOnce).to.be.true;
    const args = spawnStub.firstCall.args[1];
    expect(args).to.include('-filter_complex');
    expect(args.filter(arg => arg === '-i').length).to.equal(1);
  });
});
