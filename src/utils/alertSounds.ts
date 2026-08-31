// Alert sound utilities using Web Audio API
import { isSoundEnabled, getSoundVolume, getToneForPriority, type ToneType, type AlertPriority } from '@/hooks/useSoundSettings';

// Lazy initialization to avoid issues with SSR
let audioContext: AudioContext | null = null;

// Extended window interface for webkit prefixed AudioContext
interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    const windowWithWebkit = window as WindowWithWebkitAudioContext;
    const AudioContextClass = window.AudioContext || windowWithWebkit.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }
    audioContext = new AudioContextClass();
  }
  return audioContext;
};

// Generate a beep tone with specific parameters
const playTone = (
  frequency: number, 
  duration: number, 
  baseVolume: number = 0.3,
  type: OscillatorType = 'sine'
) => {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  // Apply user volume setting
  const userVolume = getSoundVolume();
  const adjustedVolume = baseVolume * userVolume;
  
  gainNode.gain.setValueAtTime(adjustedVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
};

// Different tone patterns
const tonePatterns = {
  beep: (intensity: number = 1) => {
    // Classic beep sound
    playTone(660 * intensity, 0.2, 0.3);
  },
  
  chime: (intensity: number = 1) => {
    // Soft chime - two ascending notes
    playTone(523 * intensity, 0.15, 0.25, 'sine');
    setTimeout(() => playTone(659 * intensity, 0.2, 0.2, 'sine'), 150);
  },
  
  alert: (intensity: number = 1) => {
    // Urgent alert - triple beep with rising pitch
    playTone(880 * intensity, 0.15, 0.4, 'square');
    setTimeout(() => playTone(880 * intensity, 0.15, 0.4, 'square'), 200);
    setTimeout(() => playTone(1100 * intensity, 0.3, 0.5, 'square'), 400);
  },
  
  notification: (intensity: number = 1) => {
    // Standard notification - soft double beep
    playTone(587 * intensity, 0.12, 0.25, 'sine');
    setTimeout(() => playTone(784 * intensity, 0.18, 0.2, 'sine'), 120);
  },
  
  ping: (intensity: number = 1) => {
    // Quick ping sound
    playTone(1200 * intensity, 0.1, 0.2, 'sine');
  },
  
  silent: () => {
    // No sound
  },
};

// Priority to intensity mapping
const priorityIntensity: Record<AlertPriority, number> = {
  CRITICAL: 1.2,
  URGENT: 1.1,
  HIGH: 1.0,
  MEDIUM: 0.9,
  LOW: 0.8,
};

// Play a specific tone type
export const playToneType = (toneType: ToneType, intensity: number = 1) => {
  if (toneType === 'silent') return;
  
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const pattern = tonePatterns[toneType];
  if (pattern) {
    pattern(intensity);
  }
};

// Play alert pattern based on priority (uses user-configured tones)
export const playAlertSound = (priority: AlertPriority) => {
  // Check if sounds are enabled
  if (!isSoundEnabled()) {
    return;
  }

  const ctx = getAudioContext();
  
  // Resume audio context if suspended (required by browsers)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Get user-configured tone for this priority
  const toneType = getToneForPriority(priority);
  const intensity = priorityIntensity[priority];
  
  playToneType(toneType, intensity);
};

// Test sound at current volume level with a specific tone
export const playTestSound = (toneType: ToneType = 'beep') => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  playToneType(toneType, 1.0);
};

// Preview a tone without checking if sounds are enabled
export const previewTone = (toneType: ToneType) => {
  if (toneType === 'silent') return;
  
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const pattern = tonePatterns[toneType];
  if (pattern) {
    pattern(1.0);
  }
};

// Check if user has interacted with the page (required for audio)
let userInteracted = false;

export const enableAudioOnInteraction = () => {
  if (userInteracted) return;
  
  const enableAudio = () => {
    userInteracted = true;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Remove listeners after first interaction
    document.removeEventListener('click', enableAudio);
    document.removeEventListener('keydown', enableAudio);
    document.removeEventListener('touchstart', enableAudio);
  };
  
  document.addEventListener('click', enableAudio);
  document.addEventListener('keydown', enableAudio);
  document.addEventListener('touchstart', enableAudio);
};

export const isAudioEnabled = () => userInteracted;
