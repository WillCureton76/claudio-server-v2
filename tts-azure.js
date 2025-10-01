// Azure TTS (Shimmer voice) handler
// Streams text to Azure Speech Service, returns MP3 audio

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

class AzureTTS {
  constructor(subscriptionKey, region = 'eastus') {
    this.subscriptionKey = subscriptionKey;
    this.region = region;
    this.endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  }

  async synthesize(text, voice = 'en-US-EmmaMultilingualNeural') {
    // Shimmer voice = en-US-EmmaMultilingualNeural (closest to what you want)
    // Or use en-US-AvaMultilingualNeural, en-US-AndrewMultilingualNeural

    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
          ${this.escapeXml(text)}
        </voice>
      </speak>
    `.trim();

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-48khz-96kbitrate-mono-mp3',
        'User-Agent': 'PlainVoiceServer'
      },
      body: ssml
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure TTS error (${response.status}): ${error}`);
    }

    return response.body; // Returns ReadableStream of MP3 audio
  }

  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Stream TTS for deltas (used with GPT-5 streaming)
  async streamDeltas(deltas, onAudioChunk) {
    // Accumulate deltas into sentences, then synthesize
    let buffer = '';
    const sentenceEnders = /[.!?]\s/;

    for (const delta of deltas) {
      buffer += delta;

      if (sentenceEnders.test(buffer)) {
        const sentences = buffer.split(sentenceEnders);
        buffer = sentences.pop() || ''; // Keep incomplete sentence

        for (const sentence of sentences) {
          if (sentence.trim()) {
            const audioStream = await this.synthesize(sentence.trim());
            await onAudioChunk(audioStream);
          }
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      const audioStream = await this.synthesize(buffer.trim());
      await onAudioChunk(audioStream);
    }
  }
}

module.exports = { AzureTTS };