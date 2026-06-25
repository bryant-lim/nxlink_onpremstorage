"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export interface AudioPlayerHandle {
  play: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ src, title }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => {
        const audio = audioRef.current;
        if (audio) {
          audio.play().catch((err) => {
            setError("Playback failed: " + err.message);
            setIsPlaying(false);
          });
        }
      },
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      setIsLoading(true);
      setError(null);
      audio.src = src;
      audio.load();
    }, [src]);

    const togglePlay = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch((err) => {
          setError("Playback failed: " + err.message);
          setIsPlaying(false);
        });
      }
    }, [isPlaying]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = parseFloat(e.target.value);
      setCurrentTime(parseFloat(e.target.value));
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
      if (audioRef.current) audioRef.current.volume = vol;
    };

    const handleSpeed = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const rate = parseFloat(e.target.value);
      setPlaybackRate(rate);
      if (audioRef.current) audioRef.current.playbackRate = rate;
    };

    const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (error) {
      return (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        {title && (
          <p className="mb-2 text-sm font-medium text-gray-700">{title}</p>
        )}

        <audio
          ref={audioRef}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
              setIsLoading(false);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onError={() => {
            setError("Failed to load audio");
            setIsLoading(false);
          }}
          onCanPlay={() => setIsLoading(false)}
          preload="auto"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isPlaying ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="3" width="3" height="14" />
                <rect x="12" y="3" width="3" height="14" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4l10 6-10 6V4z" />
              </svg>
            )}
          </button>

          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-gray-500">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-gray-500">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolume}
              className="w-16"
            />
          </div>

          <select
            value={playbackRate}
            onChange={handleSpeed}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>
    );
  },
);

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
