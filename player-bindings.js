document.querySelector('[data-bind-0]').onclick = function(event) { startVisualGuide({ manual: true }) };
document.querySelector('[data-bind-1]').onclick = function(event) { openUpdatePanel() };
document.querySelector('[data-bind-2]').onclick = function(event) { toggleDiyMode() };
document.querySelector('[data-bind-3]').onclick = function(event) { toggleDiyMode() };
document.querySelector('[data-bind-4]').onclick = function(event) { setSearchMode('song') };
document.querySelector('[data-bind-5]').onclick = function(event) { setSearchMode('netease') };
document.querySelector('[data-bind-6]').onclick = function(event) { setSearchMode('qq') };
document.querySelector('[data-bind-7]').onclick = function(event) { setSearchMode('kugou') };
document.querySelector('[data-bind-8]').onclick = function(event) { setSearchMode('qishui') };
document.querySelector('[data-bind-9]').onclick = function(event) { setSearchMode('podcast') };
document.querySelector('[data-bind-10]').onclick = function(event) { toggleUploadPanel(event) };
document.querySelector('[data-bind-11]').onclick = function(event) { clearCustomCoverForCurrent() };
document.querySelector('[data-bind-12]').onclick = function(event) { event.stopPropagation() };
document.querySelector('[data-bind-13]').onclick = function(event) { triggerUploadInput('cover') };
document.querySelector('[data-bind-14]').onclick = function(event) { triggerUploadInput('audio') };
document.querySelector('[data-bind-15]').onclick = function(event) { triggerUploadInput('folder') };
document.querySelector('[data-bind-16]').onclick = function(event) { closeUploadTip(true) };
document.querySelector('[data-bind-17]').onclick = function(event) { homeDashboardNextReview() };
document.querySelector('[data-bind-18]').onclick = function(event) { openHomeDashboardVideoPicker() };
document.querySelector('[data-bind-19]').onclick = function(event) { clearHomeDashboardVideo() };
document.querySelector('[data-bind-20]').onclick = function(event) { openHomePlayerConsole() };
document.querySelector('[data-bind-21]').onclick = function(event) { resumeHomeDashboardPlayback() };
document.querySelector('[data-bind-22]').onclick = function(event) { openHomeDashboardLibrary() };
document.querySelector('[data-bind-23]').onclick = function(event) { playHomeDaily() };
document.querySelector('[data-bind-24]').onclick = function(event) { playHomeRecent() };
document.querySelector('[data-bind-25]').onclick = function(event) { openHomeInsight() };
document.querySelector('[data-bind-26]').onclick = function(event) { playHomeNextFromDock() };
document.querySelector('[data-bind-27]').onclick = function(event) { openHomeDashboardCharts() };
document.querySelector('[data-bind-28]').onclick = function(event) { openHomeDashboardRadio() };
document.querySelector('[data-bind-29]').onclick = function(event) { toggleUserCapsuleAutoHide(event) };
document.querySelector('[data-bind-30]').onclick = function(event) { goHome() };
document.querySelector('[data-bind-31]').onclick = function(event) { onUserBtnClick() };
document.querySelector('[data-bind-32]').onclick = function(event) { toggleFxFabAutoHide(event) };
document.querySelector('[data-bind-33]').onclick = function(event) { resetUiAccentColor() };
document.querySelector('[data-bind-34]').onclick = function(event) { openCoverColorPicker('visualTint') };
document.querySelector('[data-bind-35]').onclick = function(event) { resetVisualTintColor() };
document.querySelector('[data-bind-36]').onclick = function(event) { closeCoverColorPicker() };
document.querySelector('[data-bind-37]').onclick = function(event) { pickCoverColorFromArt(event) };
document.querySelector('[data-bind-38]').onmousemove = function(event) { moveCoverColorLoupe(event) };
document.querySelector('[data-bind-39]').onmouseleave = function(event) { hideCoverColorLoupe() };
document.querySelector('[data-bind-40]').onclick = function(event) { closeColorLab() };
document.querySelector('[data-bind-41]').onclick = function(event) { resetHomeAccentColor() };
document.querySelector('[data-bind-42]').onclick = function(event) { resetHomeIconColor() };
document.querySelector('[data-bind-43]').onclick = function(event) { resetVisualIconColor() };
document.querySelector('[data-bind-44]').onclick = function(event) { resetCustomBackgroundColor() };
document.querySelector('[data-bind-45]').onclick = function(event) { toggleCustomBackgroundAlbumCover() };
document.querySelector('[data-bind-46]').onclick = function(event) { document.getElementById('background-image-input').click() };
document.querySelector('[data-bind-47]').onclick = function(event) { openCustomBackgroundCropModal() };
document.querySelector('[data-bind-48]').onclick = function(event) { clearCustomBackgroundImage() };
document.querySelector('[data-bind-49]').onclick = function(event) { openWallpaperEngineLibrary() };
document.querySelector('[data-bind-50]').onclick = function(event) { deactivateWallpaperEngineBackground() };
document.querySelector('[data-bind-51]').oninput = function(event) { setWallpaperEngineVisualSetting('opacity', this.value) };
document.querySelector('[data-bind-52]').oninput = function(event) { setWallpaperEngineVisualSetting('positionX', this.value) };
document.querySelector('[data-bind-53]').oninput = function(event) { setWallpaperEngineVisualSetting('positionY', this.value) };
document.querySelector('[data-bind-54]').oninput = function(event) { setWallpaperEngineVisualSetting('scale', this.value) };
document.querySelector('[data-bind-55]').onclick = function(event) { toggleFx('sonicAudioMonitorEnabled') };
document.querySelector('[data-bind-56]').onclick = function(event) { toggleFx('sonicAudioAutoTrack') };
document.querySelector('[data-bind-57]').onclick = function(event) { resetSonicGroundColor('sonicGroundBaseColor') };
document.querySelector('[data-bind-58]').onclick = function(event) { resetSonicGroundColor('sonicGroundCoolColor') };
document.querySelector('[data-bind-59]').onclick = function(event) { resetSonicGroundColor('sonicGroundWarmColor') };
document.querySelector('[data-bind-60]').onclick = function(event) { resetSonicGroundColor('sonicGroundAccentColor') };
document.querySelector('[data-bind-61]').onclick = function(event) { toggleFx('sonicGroundFloatingEnabled') };
document.querySelector('[data-bind-62]').onclick = function(event) { setSonicWorkshopRegionColorMode('theme','cover') };
document.querySelector('[data-bind-63]').onclick = function(event) { setSonicWorkshopRegionColorMode('base','cover') };
document.querySelector('[data-bind-64]').onclick = function(event) { setSonicWorkshopRegionColorMode('warm','cover') };
document.querySelector('[data-bind-65]').onclick = function(event) { setSonicWorkshopRegionColorMode('cool','cover') };
document.querySelector('[data-bind-66]').onclick = function(event) { setSonicWorkshopRegionColorMode('ripple','cover') };
document.querySelector('[data-bind-67]').onclick = function(event) { setSonicWorkshopRegionColorMode('peak','cover') };
document.querySelector('[data-bind-68]').onclick = function(event) { setSonicWorkshopTheme('coral-mirage') };
document.querySelector('[data-bind-69]').onclick = function(event) { setSonicWorkshopTheme('ocean-deep') };
document.querySelector('[data-bind-70]').onclick = function(event) { setSonicWorkshopTheme('arctic-aurora') };
document.querySelector('[data-bind-71]').onclick = function(event) { setSonicWorkshopTheme('cyber-forest') };
document.querySelector('[data-bind-72]').onclick = function(event) { setSonicWorkshopTheme('minimal-monochrome') };
document.querySelector('[data-bind-73]').onclick = function(event) { document.getElementById('fx-lyric-fold').classList.toggle('open') };
document.querySelector('[data-bind-74]').onclick = function(event) { setLyricColorAuto() };
document.querySelector('[data-bind-75]').onclick = function(event) { setLyricHighlightAuto() };
document.querySelector('[data-bind-76]').onclick = function(event) { handleLyricGlowRowClick(event) };
document.querySelector('[data-bind-77]').onclick = function(event) { toggleLyricGlowLink(event) };
document.querySelector('[data-bind-78]').onclick = function(event) { toggleFx('lyricGlow') };
document.querySelector('[data-bind-79]').onclick = function(event) { toggleFx('lyricGlowBeat') };
document.querySelector('[data-bind-80]').onclick = function(event) { setLyricSourceMode('original') };
document.querySelector('[data-bind-81]').onclick = function(event) { setLyricSourceMode('custom') };
document.querySelector('[data-bind-82]').onclick = function(event) { setLyricDisplayMode('single') };
document.querySelector('[data-bind-83]').onclick = function(event) { setLyricDisplayMode('dual') };
document.querySelector('[data-bind-84]').onclick = function(event) { setLyricDisplayMode('triple') };
document.querySelector('[data-bind-85]').onclick = function(event) { setLyricDisplayMode('cinema') };
document.querySelector('[data-bind-86]').onclick = function(event) { setLyricDisplayMode('custom') };
document.querySelector('[data-bind-87]').onclick = function(event) { setLyricTranslationMode('off') };
document.querySelector('[data-bind-88]').onclick = function(event) { setLyricTranslationMode('current') };
document.querySelector('[data-bind-89]').onclick = function(event) { setLyricTranslationMode('dual') };
document.querySelector('[data-bind-90]').onclick = function(event) { setLyricTranslationMode('multi') };
document.querySelector('[data-bind-91]').onclick = function(event) { setLyricMotionStyle('float') };
document.querySelector('[data-bind-92]').onclick = function(event) { setLyricMotionStyle('smooth') };
document.querySelector('[data-bind-93]').onclick = function(event) { setLyricMotionStyle('glass') };
document.querySelector('[data-bind-94]').onclick = function(event) { setLyricMotionStyle('shine') };
document.querySelector('[data-bind-95]').onclick = function(event) { setLyricMotionStyle('glitch') };
document.querySelector('[data-bind-96]').onclick = function(event) { toggleLyricGlitchCameraBind() };
document.querySelector('[data-bind-97]').onclick = function(event) { setLyricTextureClarity(1) };
document.querySelector('[data-bind-98]').onclick = function(event) { setLyricTextureClarity(2) };
document.querySelector('[data-bind-99]').onclick = function(event) { setLyricTextureClarity(3) };
document.querySelector('[data-bind-100]').onclick = function(event) { setLyricTextureClarity(4) };
document.querySelector('[data-bind-101]').onclick = function(event) { setLyricFont('sans') };
document.querySelector('[data-bind-102]').onclick = function(event) { setLyricFont('hei') };
document.querySelector('[data-bind-103]').onclick = function(event) { setLyricFont('song') };
document.querySelector('[data-bind-104]').onclick = function(event) { setLyricFont('bold-song') };
document.querySelector('[data-bind-105]').onclick = function(event) { setLyricFont('stone-song') };
document.querySelector('[data-bind-106]').onclick = function(event) { setLyricFont('kai-song') };
document.querySelector('[data-bind-107]').onclick = function(event) { setLyricFont('serif-en') };
document.querySelector('[data-bind-108]').onclick = function(event) { setLyricFont('gothic') };
document.querySelector('[data-bind-109]').onclick = function(event) { setLyricFont('editorial') };
document.querySelector('[data-bind-110]').onclick = function(event) { setLyricFont('humanist') };
document.querySelector('[data-bind-111]').onclick = function(event) { setLyricFont('mono') };
document.querySelector('[data-bind-112]').onclick = function(event) { setLyricFont('display') };
document.querySelector('[data-bind-113]').onclick = function(event) { triggerLyricFontUpload() };
document.querySelector('[data-bind-114]').onclick = function(event) { document.getElementById('fx-overlay-fold').classList.toggle('open') };
document.querySelector('[data-bind-115]').onclick = function(event) { toggleFx('floatLayer') };
document.querySelector('[data-bind-116]').onclick = function(event) { toggleFx('cinema') };
document.querySelector('[data-bind-117]').onclick = function(event) { toggleFx('lyricGlow') };
document.querySelector('[data-bind-118]').onclick = function(event) { toggleFx('lyricGlowBeat') };
document.querySelector('[data-bind-119]').onclick = function(event) { toggleFx('lyricGlowParticles') };
document.querySelector('[data-bind-120]').onclick = function(event) { toggleFx('backgroundStarRiver') };
document.querySelector('[data-bind-121]').onclick = function(event) { toggleFx('lyricVerticalFloat') };
document.querySelector('[data-bind-122]').onclick = function(event) { toggleFx('lyricPauseHold') };
document.querySelector('[data-bind-123]').onclick = function(event) { toggleFx('lyricCameraLock') };
document.querySelector('[data-bind-124]').onclick = function(event) { toggleFx('bloom') };
document.querySelector('[data-bind-125]').onclick = function(event) { toggleFx('edge') };
document.querySelector('[data-bind-126]').onclick = function(event) { toggleFx('desktopLyrics') };
document.querySelector('[data-bind-127]').onclick = function(event) { toggleFx('desktopLyricsClickThrough') };
document.querySelector('[data-bind-128]').onclick = function(event) { toggleFx('desktopLyricsCinema') };
document.querySelector('[data-bind-129]').onclick = function(event) { toggleFx('desktopLyricsHighlight') };
document.querySelector('[data-bind-130]').onclick = function(event) { toggleFx('wallpaperMode') };
document.querySelector('[data-bind-131]').onclick = function(event) { document.getElementById('fx-stage-fold').classList.toggle('open') };
document.querySelector('[data-bind-132]').onclick = function(event) { toggleFx('shelfShowPodcasts') };
document.querySelector('[data-bind-133]').onclick = function(event) { toggleFx('shelfMergeCollections') };
document.querySelector('[data-bind-134]').onclick = function(event) { resetShelfAccentColor() };
document.querySelector('[data-bind-135]').onclick = function(event) { toggleGesturePlayerActions() };
document.querySelector('[data-bind-136]').onclick = function(event) { toggleGestureHandOverlay() };
document.querySelector('[data-bind-137]').onclick = function(event) { setGestureSensitivity('steady') };
document.querySelector('[data-bind-138]').onclick = function(event) { setGestureSensitivity('balanced') };
document.querySelector('[data-bind-139]').onclick = function(event) { setGestureSensitivity('quick') };
document.querySelector('[data-bind-140]').onclick = function(event) { document.getElementById('fx-advanced').classList.toggle('open') };
document.querySelector('[data-bind-141]').onclick = function(event) { toggleStartupAutoplay() };
document.querySelector('[data-bind-142]').onclick = function(event) { toggleStartupFastSkip() };
document.querySelector('[data-bind-143]').onclick = function(event) { refreshAudioOutputDevices(true) };
document.querySelector('[data-bind-144]').onclick = function(event) { openAudioOutputWorkflowPanel() };
document.querySelector('[data-bind-145]').onclick = function(event) { toggleFx('lyricLiveViewportFit') };
document.querySelector('[data-bind-146]').onclick = function(event) { toggleFx('lyricContextHighQuality') };
document.querySelector('[data-bind-147]').onclick = function(event) { toggleFx('lyricBackdropAdapt') };
document.querySelector('[data-bind-148]').onclick = function(event) { toggleFx('coverBackdropAdapt') };
document.querySelector('[data-bind-149]').onclick = function(event) { toggleFx('liveBackgroundKeep') };
document.querySelector('[data-bind-150]').onclick = function(event) { toggleFx('memoryAutoTrimApp') };
document.querySelector('[data-bind-151]').onclick = function(event) { toggleFx('memoryAutoTrimOnBackground') };
document.querySelector('[data-bind-152]').onclick = function(event) { toggleFx('memoryAutoSystemTrim') };
document.querySelector('[data-bind-153]').onclick = function(event) { toggleFx('memorySystemAutoElevate') };
document.querySelector('[data-bind-154]').onclick = function(event) { runAppMemoryTrim('manual') };
document.querySelector('[data-bind-155]').onclick = function(event) { runSystemMemoryPurge(false) };
document.querySelector('[data-bind-156]').onclick = function(event) { runSystemMemoryPurge(true) };
document.querySelector('[data-bind-157]').onclick = function(event) { chooseMineradioCacheRoot() };
document.querySelector('[data-bind-158]').onclick = function(event) { refreshMineradioCacheSettings() };
document.querySelector('[data-bind-159]').onclick = function(event) { restartMineradioForCachePath() };
document.querySelector('[data-bind-160]').onclick = function(event) { resetFx() };
document.querySelector('[data-bind-161]').onclick = function(event) { togglePlaylistPanelPinned() };
document.querySelector('[data-bind-162]').onclick = function(event) { shuffleQueue() };
document.querySelector('[data-bind-163]').onclick = function(event) { switchPlaylistTab('queue') };
document.querySelector('[data-bind-164]').onclick = function(event) { switchPlaylistTab('playlists') };
document.querySelector('[data-bind-165]').onclick = function(event) { switchPlaylistTab('podcasts') };
document.querySelector('[data-bind-166]').onclick = function(event) { cyclePlayMode() };
document.querySelector('[data-bind-167]').onclick = function(event) { clearQueue() };
document.querySelector('[data-bind-168]').onclick = function(event) { promptCreateBuiltInPlaylist() };
document.querySelector('[data-bind-169]').onclick = function(event) { refreshUserPlaylists(true) };
document.querySelector('[data-bind-170]').onclick = function(event) { refreshUserPlaylists(true) };
document.querySelector('[data-bind-171]').onclick = function(event) { showLoginModal() };
document.querySelector('[data-bind-172]').onclick = function(event) { document.getElementById('trial-banner').classList.remove('show') };
document.querySelector('[data-bind-173]').onclick = function(event) { openTrackDetailModal('album') };
document.querySelector('[data-bind-174]').onkeydown = function(event) { if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrackDetailModal('album')} };
document.querySelector('[data-bind-175]').onclick = function(event) { openTrackDetailModal('song') };
document.querySelector('[data-bind-176]').onclick = function(event) { openTrackDetailModal('artist') };
document.querySelector('[data-bind-177]').onclick = function(event) { event.stopPropagation() };
document.querySelector('[data-bind-178]').onclick = function(event) { closeMiniQueue() };
document.querySelector('[data-bind-179]').onclick = function(event) { openTrackDetailModal('album') };
document.querySelector('[data-bind-180]').onkeydown = function(event) { if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrackDetailModal('album')} };
document.querySelector('[data-bind-181]').onclick = function(event) { openTrackDetailModal('song') };
document.querySelector('[data-bind-182]').onclick = function(event) { toggleQualityPanel(event) };
document.querySelector('[data-bind-183]').onclick = function(event) { event.stopPropagation() };
document.querySelector('[data-bind-184]').onclick = function(event) { openTrackDetailModal('artist') };
document.querySelector('[data-bind-185]').onclick = function(event) { toggleLikeCurrent() };
document.querySelector('[data-bind-186]').onclick = function(event) { openCollectModalForCurrent() };
document.querySelector('[data-bind-187]').onclick = function(event) { cyclePlayMode() };
document.querySelector('[data-bind-188]').onclick = function(event) { toggleCuefieldAutoMix() };
document.querySelector('[data-bind-189]').onclick = function(event) { prevTrack(true) };
document.querySelector('[data-bind-190]').onclick = function(event) { togglePlay() };
document.querySelector('[data-bind-191]').onclick = function(event) { nextTrack(true) };
document.querySelector('[data-bind-192]').onclick = function(event) { openPlaylistPanelTab('playlists') };
document.querySelector('[data-bind-193]').onclick = function(event) { toggleMiniQueue(event) };
document.querySelector('[data-bind-194]').onclick = function(event) { toggleLyricsPanel() };
document.querySelector('[data-bind-195]').onclick = function(event) { event.stopPropagation() };
document.querySelector('[data-bind-196]').onclick = function(event) { toggleVolumePanel(event) };
document.querySelector('[data-bind-197]').onclick = function(event) { event.stopPropagation() };
document.querySelector('[data-bind-198]').onclick = function(event) { toggleControlsAutoHide() };
document.querySelector('[data-bind-199]').onclick = function(event) { toggleImmersiveMode() };
document.querySelector('[data-bind-200]').onclick = function(event) { toggleFullscreen() };
document.querySelector('[data-bind-201]').onclick = function(event) { logoutAllAccountsAndResetEasterEgg() };
document.querySelector('[data-bind-202]').onclick = function(event) { closeLoginModal() };
document.querySelector('[data-bind-203]').onclick = function(event) { handleLoginEasterEggTap() };
document.querySelector('[data-bind-204]').onclick = function(event) { selectLoginProviderNode('netease') };
document.querySelector('[data-bind-205]').onclick = function(event) { selectLoginProviderNode('qq') };
document.querySelector('[data-bind-206]').onclick = function(event) { selectLoginProviderNode('kugou') };
document.querySelector('[data-bind-207]').onclick = function(event) { selectLoginProviderNode('qishui') };
document.querySelector('[data-bind-208]').onclick = function(event) { selectLoginMode('official') };
document.querySelector('[data-bind-209]').onclick = function(event) { selectLoginMode('cookie') };
document.querySelector('[data-bind-210]').onclick = function(event) { openProviderWebLogin() };
document.querySelector('[data-bind-211]').onclick = function(event) { submitQQCookieLogin() };
document.querySelector('[data-bind-212]').onclick = function(event) { skipLoginAndFocusSearch() };
document.querySelector('[data-bind-213]').onclick = function(event) { toggleQQCookiePanel() };
document.querySelector('[data-bind-214]').onclick = function(event) { startSelectedLoginConnection() };
document.querySelector('[data-bind-215]').onclick = function(event) { dismissLoginEasterEggCinematic() };
document.querySelector('[data-bind-216]').onclick = function(event) { closeAudioOutputWorkflowPanel() };
document.querySelector('[data-bind-217]').onclick = function(event) { setAudioOutputDevice('', true) };
document.querySelector('[data-bind-218]').onclick = function(event) { refreshAudioOutputDevices(true) };
document.querySelector('[data-bind-219]').onclick = function(event) { setActiveAccountProvider('netease') };
document.querySelector('[data-bind-220]').onclick = function(event) { setActiveAccountProvider('qq') };
document.querySelector('[data-bind-221]').onclick = function(event) { setActiveAccountProvider('kugou') };
document.querySelector('[data-bind-222]').onclick = function(event) { setActiveAccountProvider('qishui') };
document.querySelector('[data-bind-223]').onclick = function(event) { enableDualAccountView() };
document.querySelector('[data-bind-224]').onclick = function(event) { openProviderLogin('netease') };
document.querySelector('[data-bind-225]').onclick = function(event) { openProviderLogin('qq') };
document.querySelector('[data-bind-226]').onclick = function(event) { openProviderLogin('kugou') };
document.querySelector('[data-bind-227]').onclick = function(event) { openProviderLogin('qishui') };
document.querySelector('[data-bind-228]').onclick = function(event) { closeUserModal() };
document.querySelector('[data-bind-229]').onclick = function(event) { logoutActiveAccount() };
document.querySelector('[data-bind-230]').onclick = function(event) { closeCoverCropModal() };
document.querySelector('[data-bind-231]').onclick = function(event) { commitCoverCrop() };
document.querySelector('[data-bind-232]').onclick = function(event) { cancelCustomBackgroundCropModal() };
document.querySelector('[data-bind-233]').onclick = function(event) { resetCustomBackgroundCropInModal() };
document.querySelector('[data-bind-234]').onclick = function(event) { commitCustomBackgroundCropModal() };
document.querySelector('[data-bind-235]').onclick = function(event) { if(event.target===this)closeWallpaperEngineLibrary() };
document.querySelector('[data-bind-236]').onclick = function(event) { closeWallpaperEngineLibrary() };
document.querySelector('[data-bind-237]').oninput = function(event) { scheduleWallpaperEngineLibraryRender() };
document.querySelector('[data-bind-238]').onclick = function(event) { chooseWallpaperEngineProjectFile() };
document.querySelector('[data-bind-239]').onclick = function(event) { chooseWallpaperEngineDirectory() };
document.querySelector('[data-bind-240]').onclick = function(event) { refreshWallpaperEngineLibrary() };
document.querySelector('[data-bind-241]').onclick = function(event) { restoreHiddenWallpaperEngineItems() };
document.querySelector('[data-bind-242]').onclick = function(event) { if(event.target===this)closeWallpaperEngineProjectDetails() };
document.querySelector('[data-bind-243]').onclick = function(event) { closeWallpaperEngineProjectDetails() };
document.querySelector('[data-bind-244]').onclick = function(event) { launchWallpaperEngineProjectDetails('we') };
document.querySelector('[data-bind-245]').onclick = function(event) { launchWallpaperEngineProjectDetails('workshop') };
document.querySelector('[data-bind-246]').onclick = function(event) { createPlaylistFromCollect() };
document.querySelector('[data-bind-247]').onclick = function(event) { closeCollectModal() };
document.querySelector('[data-bind-248]').onclick = function(event) { selectLocalBeatMode('mr') };
document.querySelector('[data-bind-249]').onclick = function(event) { selectLocalBeatMode('dj') };
document.querySelector('[data-bind-250]').onclick = function(event) { closeLocalBeatModal() };
document.querySelector('[data-bind-251]').onclick = function(event) { cancelLocalBeatAnalysis() };
document.querySelector('[data-bind-252]').onclick = function(event) { startLocalBeatAnalysis() };
document.querySelector('[data-bind-253]').onclick = function(event) { deleteCustomLyricForCurrent() };
document.querySelector('[data-bind-254]').onclick = function(event) { closeCustomLyricModal() };
document.querySelector('[data-bind-255]').onclick = function(event) { saveCustomLyricForCurrent() };
document.querySelector('[data-bind-256]').onclick = function(event) { closeTrackDetailModal() };
document.querySelector('[data-bind-257]').onclick = function(event) { startUpdatePreviewDownload() };
document.querySelector('[data-bind-258]').onclick = function(event) { closeUpdatePanel() };
document.querySelector('[data-bind-259]').onclick = function(event) { submitCuefieldFeedback(1) };
document.querySelector('[data-bind-260]').onclick = function(event) { submitCuefieldFeedback(2) };
document.querySelector('[data-bind-261]').onclick = function(event) { submitCuefieldFeedback(3) };
document.querySelector('[data-bind-262]').onclick = function(event) { dismissCookieExportPrompt(false) };
document.querySelector('[data-bind-263]').onclick = function(event) { confirmCookieExportPrompt() };
document.querySelector('[data-bind-264]').onclick = function(event) { closeSourceFallbackNotice() };
document.querySelector('[data-bind-265]').onclick = function(event) { closeVisualGuide(true) };
document.querySelector('[data-bind-266]').onclick = function(event) { nextVisualGuideStep() };
(function(){
const actions=[function(event) { setPlaybackQuality(this.dataset.mrValue) },
function(event) { openAudioOutputWorkflowPanel() },
function(event) { handleHomeTileClick(Number(this.dataset.mrIndex)) },
function(event) { homeDashboardNextReview() },
function(event) { openHomeDashboardVideoPicker() },
function(event) { clearHomeDashboardVideo() },
function(event) { openHomePlayerConsole() },
function(event) { openHomeDashboardLibrary() },
function(event) { playHomeDashboardDiscoverySong(Number(this.dataset.mrIndex)) },
function(event) { toggleAlbumCollection() },
function(event) { toggleAlbumGaplessPlayback() },
function(event) { this.style.opacity=0.18 },
function(event) { event.stopPropagation();collectAlbumDetailSong(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queueAlbumDetailSongNext(Number(this.dataset.mrIndex)) },
function(event) { playAlbumDetailSong(Number(this.dataset.mrIndex)) },
function(event) { submitDetailComment() },
function(event) { this.style.opacity=0.18 },
function(event) { event.stopPropagation();collectArtistDetailSong(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queueArtistDetailSongNext(Number(this.dataset.mrIndex)) },
function(event) { playArtistDetailSong(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();window['toggleLike' + this.dataset.mrSource](Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();window['collect' + this.dataset.mrSource](Number(this.dataset.mrIndex)) },
function(event) { addCollectTargetToBuiltInPlaylist(this.getAttribute('data-built-in-pid')) },
function(event) { addCollectTargetToPlaylist(this.getAttribute('data-collect-pid')) },
function(event) { this.style.opacity=0.2 },
function(event) { openPodcastPrograms(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();openPodcastPrograms(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();renderPodcastRadios(podcastResults) },
function(event) { event.stopPropagation();renderPodcastRadios(podcastResults) },
function(event) { playPodcastProgram(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queuePodcastProgram(Number(this.dataset.mrIndex)) },
function(event) { toggleControlSourceSwitcher(event) },
function(event) { switchCurrentSongSource('' + provider.key + '') },
function(event) { event.stopPropagation();openSearchResultArtist(Number(this.dataset.mrIndex)) },
function(event) { this.style.opacity=0.2 },
function(event) { playSearchResult(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();toggleLikeSearchResult(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();collectSearchResult(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queueSearchResult(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();retryPlaylistQueueHydration() },
function(event) { event.stopPropagation();requestPlaylistQueueHydrationForBrowse() },
function(event) { this.style.opacity=0.2 },
function(event) { if(window.__mineradioSuppressReorderClick)return;playQueueAt(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queueIndexNext(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();removeFromQueue(Number(this.dataset.mrIndex)) },
function(event) { this.style.opacity=0.2 },
function(event) { if(window.__mineradioSuppressReorderClick)return;playQueueAt(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();openQueueArtist(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();toggleLikeQueueIndex(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();queueIndexNext(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();collectQueueIndex(Number(this.dataset.mrIndex)) },
function(event) { event.stopPropagation();removeFromQueue(Number(this.dataset.mrIndex)) },
function(event) { this.style.opacity=0.2 },
function(event) { this.style.opacity=0.2 },
function(event) { this.style.opacity=0.2 },
function(event) { this.style.opacity=0.2 },
function(event) { this.style.opacity=0.2 },
function(event) { handleUserFxArchiveRenameKey(event,Number(this.dataset.mrIndex)) },
function(event) { commitUserFxArchiveRename(Number(this.dataset.mrIndex)) },
function(event) { cancelUserFxArchiveRename() },
function(event) { applyUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { saveUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { renameUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { createUserFxArchive() },
function(event) { importUserFxArchiveFromShareCodePrompt() },
function(event) { importUserFxArchiveFromDialog() },
function(event) { updateUserFxArchiveShareDraft(this.value) },
function(event) { handleUserFxArchiveShareInputKey(event) },
function(event) { pasteUserFxArchiveShareCodeToBox() },
function(event) { importUserFxArchiveShareCodeFromBox() },
function(event) { clearUserFxArchiveShareCodeBox() },
function(event) { handleUserFxArchiveRenameKey(event,Number(this.dataset.mrIndex)) },
function(event) { commitUserFxArchiveRename(Number(this.dataset.mrIndex)) },
function(event) { cancelUserFxArchiveRename() },
function(event) { applyUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { saveUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { copyUserFxArchiveShareCode(Number(this.dataset.mrIndex)) },
function(event) { renameUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { exportUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { removeUserFxArchive(Number(this.dataset.mrIndex)) },
function(event) { createUserFxArchive() },
function(event) { setLyricColorAuto() },
function(event) { setLyricColorPreset(Number(this.dataset.mrIndex)) },
function(event) { applyCoverPickerColor(this.dataset.mrValue) },
function(event) { removeCustomLyricFont(event,this.dataset.mrValue) },
function(event) { setPreset(Number(this.dataset.mrIndex)) },
function(event) { openSpotifyDeveloperDashboard() },
function(event) { copySpotifyRedirectUri() }];
const types=['click', 'error', 'input', 'keydown'];

    const selector=types.map(type=>'[data-mr-'+type+']').concat('[data-mr-home]').join(',');
    function bind(el){
      for(const type of types){
        const key=el.getAttribute('data-mr-'+type);
        if(key!==null) el['on'+type]=actions[key];
      }
      if(el.hasAttribute('data-mr-home')) el.onclick=function(){
        switch(this.dataset.mrHome){
          case 'resumeHomeDashboardPlayback()':return resumeHomeDashboardPlayback();
          case 'openHomeDashboardLibrary()':return openHomeDashboardLibrary();
          case 'playHomeDaily()':return playHomeDaily();
          case 'playHomeRecent()':return playHomeRecent();
        }
      };
    }
    document.querySelectorAll(selector).forEach(bind);
    new MutationObserver(records=>{
      for(const record of records) for(const node of record.addedNodes){
        if(node.nodeType!==1) continue;
        if(node.matches(selector)) bind(node);
        node.querySelectorAll(selector).forEach(bind);
      }
    }).observe(document.body,{childList:true,subtree:true});
    })();