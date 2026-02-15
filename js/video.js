/**
 * video.js — Video player with fullscreen support
 */

export function initVideo(onComplete) {
  const video = document.getElementById('gift-video');
  const playBtn = document.getElementById('video-play-btn');
  const placeholder = document.getElementById('video-placeholder');
  const container = document.getElementById('video-container');
  const continueBtn = document.getElementById('btn-video-continue');

  // Check if video has a source
  const hasSource = video.querySelector('source') !== null ||
                    (video.src && video.src !== '' && video.src !== window.location.href);

  if (!hasSource) {
    // Show placeholder
    playBtn.style.display = 'none';
    placeholder.style.display = 'flex';
    // Still let them continue
    continueBtn.classList.add('show');
    return;
  }

  // Hide placeholder, show play button
  placeholder.style.display = 'none';
  playBtn.style.display = 'flex';

  async function enterFullscreenAndPlay() {
    try {
      // Try fullscreen on the video element first (best experience)
      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (video.webkitRequestFullscreen) {
        await video.webkitRequestFullscreen();
      } else if (video.webkitEnterFullScreen) {
        // iOS Safari fallback — native fullscreen
        video.webkitEnterFullScreen();
      }
    } catch (err) {
      // Fullscreen might be blocked; try container instead
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        }
      } catch (err2) {
        // Carry on without fullscreen — the video will still play inline
        console.warn('Fullscreen not available:', err2);
      }
    }

    video.play();
    playBtn.style.display = 'none';
  }

  playBtn.addEventListener('click', enterFullscreenAndPlay);

  // When video ends, show the continue button
  video.addEventListener('ended', () => {
    // Exit fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    continueBtn.classList.add('show');
  });

  // Also show continue button if user exits fullscreen early (give them an out)
  function onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (video.currentTime > 0) {
        continueBtn.classList.add('show');
      }
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
