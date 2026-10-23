// Nahrávání vlastního hlasu (jen v paměti okna, nikam se neposílá). Bez práce s DOM – testuje se v Node.
(function (root) {
  const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

  const fail = (code) => Object.assign(new Error(code), { code });

  function pickMime(MediaRecorderClass) {
    if (typeof MediaRecorderClass.isTypeSupported !== 'function') return '';
    return MIME_CANDIDATES.find((m) => MediaRecorderClass.isTypeSupported(m)) || '';
  }

  // env: { mediaDevices, MediaRecorder, Blob, setTimeout, clearTimeout } – hodnoty se čtou až při použití.
  function create(env) {
    let busy = false;

    function isSupported() {
      const md = env.mediaDevices;
      return Boolean(md && typeof md.getUserMedia === 'function' && env.MediaRecorder);
    }

    // Vrátí { done, stop } po spuštění mikrofonu; done se splní, když se nahrávání zastaví (ručně nebo po maxMs).
    async function record(maxMs) {
      if (!isSupported()) throw fail('unsupported');
      if (busy) throw fail('busy');
      busy = true;
      let stream;
      try {
        stream = await env.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        busy = false;
        const name = e && e.name;
        throw fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'nomic' : 'failed');
      }
      const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
      const mimeType = pickMime(env.MediaRecorder);
      let recorder;
      try {
        recorder = mimeType ? new env.MediaRecorder(stream, { mimeType }) : new env.MediaRecorder(stream);
      } catch (e) {
        stopTracks();
        busy = false;
        throw fail('failed');
      }

      const chunks = [];
      let timer = null;
      const cleanup = () => {
        if (timer !== null) env.clearTimeout(timer);
        stopTracks();
        busy = false;
      };
      const stop = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };
      const done = new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        recorder.onerror = () => {
          cleanup();
          reject(fail('failed'));
        };
        recorder.onstop = () => {
          cleanup();
          const type = recorder.mimeType || mimeType || 'audio/mp4';
          resolve({ blob: new env.Blob(chunks, { type }), mimeType: type });
        };
      });
      recorder.start();
      timer = env.setTimeout(stop, maxMs);
      return { done, stop };
    }

    return { isSupported, record, isBusy: () => busy };
  }

  const Recorder = { create, pickMime };

  if (typeof module !== 'undefined' && module.exports) module.exports = Recorder;
  else root.Recorder = Recorder;
})(typeof window !== 'undefined' ? window : globalThis);
