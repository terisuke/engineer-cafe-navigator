/**
 * Audio Data Processing Utility
 * 
 * Centralized utility for audio data processing, conversion, and validation.
 * Eliminates code duplication across audio services and provides consistent
 * base64 handling, format detection, and data conversion.
 * 
 * @author Engineer Cafe Navigator Team
 * @since 2025-06-24
 */

export type AudioFormat = 'audio/mp3' | 'audio/mpeg' | 'audio/wav' | 'audio/mp4' | 'audio/ogg' | 'audio/webm' | 'audio/flac';

export interface AudioDataInfo {
  format: AudioFormat;
  size: number;
  isValid: boolean;
}

export interface AudioProcessingResult<T = Blob> {
  success: boolean;
  data?: T;
  error?: string;
  info?: AudioDataInfo;
}

/**
 * Centralized audio data processor
 * Handles all audio data conversion, validation, and format detection
 */
export class AudioDataProcessor {
  private static readonly CHUNK_SIZE = 8192;
  private static readonly BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
  
  /**
   * Clean and validate base64 string
   * Removes data URL prefixes, whitespace, and ensures proper padding
   */
  static cleanBase64(data: string): string {
    if (!data || data.length === 0) {
      throw new Error('Invalid or empty base64 data');
    }

    let cleaned = data;

    // Remove data URL prefix if present (data:audio/mp3;base64,...)
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[1];
    }

    // Remove any whitespace and non-base64 characters
    cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');

    // Validate base64 pattern
    if (!this.BASE64_PATTERN.test(cleaned)) {
      throw new Error('Invalid base64 format');
    }

    // Ensure proper padding
    while (cleaned.length % 4 !== 0) {
      cleaned += '=';
    }

    return cleaned;
  }

  /**
   * Convert base64 string to Blob with proper MIME type detection
   */
  static async base64ToBlob(data: string, mimeType?: string): Promise<AudioProcessingResult<Blob>> {
    try {
      console.log('[AudioDataProcessor] base64ToBlob called with:', {
        dataLength: data.length,
        startsWithData: data.startsWith('data:'),
        mimeType,
        dataPrefix: data.substring(0, 100),
        isEmpty: data.length === 0,
        hasValidBase64Chars: /^[A-Za-z0-9+/]*={0,2}$/.test(data.replace(/^data:[^;]*;base64,/, ''))
      });
      
      let processedData: string;
      let detectedFormat: AudioFormat;

      // Handle data URL format
      if (data.startsWith('data:')) {
        // Use fetch for data URLs as it's more reliable
        const response = await fetch(data);
        if (!response.ok) {
          return {
            success: false,
            error: `Failed to fetch data URL: ${response.statusText}`
          };
        }
        const blob = await response.blob();
        
        return {
          success: true,
          data: blob,
          info: {
            format: (blob.type as AudioFormat) || 'audio/mp3',
            size: blob.size,
            isValid: true
          }
        };
      }

      // Process raw base64
      processedData = this.cleanBase64(data);
      console.log('[AudioDataProcessor] After cleanBase64:', {
        originalLength: data.length,
        cleanedLength: processedData.length,
        cleanedPrefix: processedData.substring(0, 50)
      });
      
      // Convert to binary
      const binaryString = atob(processedData);
      console.log('[AudioDataProcessor] After atob:', {
        binaryStringLength: binaryString.length,
        firstFewBytes: Array.from(binaryString.substring(0, 10)).map(c => c.charCodeAt(0))
      });
      
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Detect format if not provided
      if (!mimeType) {
        detectedFormat = this.detectAudioFormat(bytes.buffer);
      } else {
        detectedFormat = mimeType as AudioFormat;
      }

      const blob = new Blob([bytes], { type: detectedFormat });
      
      // Validate blob
      console.log('[AudioDataProcessor] Generated blob:', {
        size: blob.size,
        type: blob.type,
        isEmpty: blob.size === 0
      });
      
      if (blob.size === 0) {
        console.error('[AudioDataProcessor] ERROR: Generated blob is empty!');
        return {
          success: false,
          error: 'Generated blob is empty'
        };
      }

      return {
        success: true,
        data: blob,
        info: {
          format: detectedFormat,
          size: blob.size,
          isValid: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during base64 to blob conversion'
      };
    }
  }

  /**
   * Convert ArrayBuffer to base64 string with chunked processing
   * Prevents stack overflow with large audio files
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): AudioProcessingResult<string> {
    try {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      
      // Process in chunks to avoid stack overflow
      for (let i = 0; i < bytes.byteLength; i += this.CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + this.CHUNK_SIZE, bytes.byteLength));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64 = btoa(binary);
      
      return {
        success: true,
        data: base64,
        info: {
          format: this.detectAudioFormat(buffer),
          size: buffer.byteLength,
          isValid: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert ArrayBuffer to base64'
      };
    }
  }

  /**
   * Detect audio format from ArrayBuffer by examining file headers
   */
  static detectAudioFormat(buffer: ArrayBuffer): AudioFormat {
    const bytes = new Uint8Array(buffer);
    
    if (bytes.length < 12) {
      return 'audio/wav'; // Default fallback
    }

    // MP3: ID3 tag or MPEG sync word
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
        (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) { // MPEG sync
      return 'audio/mpeg';
    }

    // WAV: RIFF header + WAVE format
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) { // WAVE
      return 'audio/wav';
    }

    // MP4/AAC: ftyp box
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) { // ftyp
      return 'audio/mp4';
    }

    // OGG: OggS signature
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) { // OggS
      return 'audio/ogg';
    }

    // WebM: EBML signature
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) { // EBML
      return 'audio/webm';
    }

    // FLAC: fLaC signature
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) { // fLaC
      return 'audio/flac';
    }

    // Default to MP3 if format cannot be determined
    console.warn('[AudioDataProcessor] Could not detect audio format, defaulting to audio/mpeg');
    return 'audio/mpeg';
  }

  /**
   * Validate if string is valid base64
   */
  static isValidBase64(str: string): boolean {
    if (!str || str.length === 0) {
      return false;
    }
    
    try {
      const cleaned = this.cleanBase64(str);
      // Try to decode to verify validity
      atob(cleaned);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create blob URL from audio data with automatic cleanup
   */
  static async createBlobUrl(data: string | ArrayBuffer | Blob, mimeType?: string): Promise<AudioProcessingResult<string>> {
    try {
      console.log('[AudioDataProcessor] createBlobUrl called with:', {
        dataType: typeof data,
        dataLength: data instanceof ArrayBuffer ? data.byteLength : 
                   data instanceof Blob ? data.size : data.length,
        mimeType,
        isBlob: data instanceof Blob,
        isArrayBuffer: data instanceof ArrayBuffer,
        isString: typeof data === 'string'
      });
      
      let blob: Blob;

      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        const format = mimeType || this.detectAudioFormat(data);
        blob = new Blob([data], { type: format });
      } else if (typeof data === 'string') {
        const result = await this.base64ToBlob(data, mimeType);
        if (!result.success || !result.data) {
          return {
            success: false,
            error: result.error || 'Failed to create blob from base64 data'
          };
        }
        blob = result.data;
      } else {
        return {
          success: false,
          error: 'Unsupported audio data type'
        };
      }

      const url = URL.createObjectURL(blob);
      
      return {
        success: true,
        data: url,
        info: {
          format: (blob.type as AudioFormat) || 'audio/mpeg',
          size: blob.size,
          isValid: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create blob URL'
      };
    }
  }

  /**
   * Clean up blob URL to prevent memory leaks
   */
  static cleanupBlobUrl(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Validate if audio data is in a supported format
   */
  static validateAudioData(data: string | ArrayBuffer | Blob): AudioProcessingResult<boolean> {
    try {
      if (data instanceof Blob) {
        return {
          success: true,
          data: true,
          info: {
            format: (data.type as AudioFormat) || 'audio/mpeg',
            size: data.size,
            isValid: true
          }
        };
      }

      if (data instanceof ArrayBuffer) {
        const format = this.detectAudioFormat(data);
        return {
          success: true,
          data: true,
          info: {
            format,
            size: data.byteLength,
            isValid: true
          }
        };
      }

      if (typeof data === 'string') {
        if (data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http')) {
          return {
            success: true,
            data: true,
            info: {
              format: 'audio/mpeg', // Default for URLs
              size: data.length,
              isValid: true
            }
          };
        }

        // Validate base64
        const isValid = this.isValidBase64(data);
        return {
          success: true,
          data: isValid,
          info: {
            format: 'audio/mpeg',
            size: data.length,
            isValid
          }
        };
      }

      return {
        success: false,
        error: 'Unsupported audio data type'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio data validation failed'
      };
    }
  }
}