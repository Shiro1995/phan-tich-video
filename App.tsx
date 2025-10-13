/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may not obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the apecific language governing permissions and
// limitations under the License.

import c from 'classnames';
import {useRef, useState} from 'react';
import {generateContent, uploadFile} from './api';
import Chart from './Chart.jsx';
import functions from './functions';
import modes from './modes';
import {generateSrtContent, timeToSecs} from './utils';
import VideoPlayer from './VideoPlayer.jsx';

const chartModes = Object.keys(modes.Chart.subModes);

export default function App() {
  const [vidUrl, setVidUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [timecodeList, setTimecodeList] = useState(null);
  const [requestedTimecode, setRequestedTimecode] = useState(null);
  // FIX: Type the selectedMode state to be a key of the modes object.
  const [selectedMode, setSelectedMode] = useState<keyof typeof modes>(
    Object.keys(modes)[0] as keyof typeof modes,
  );
  // FIX: Type the activeMode state to be a key of the modes object.
  const [activeMode, setActiveMode] = useState<keyof typeof modes>();
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [chartMode, setChartMode] = useState(chartModes[0]);
  const [chartPrompt, setChartPrompt] = useState('');
  const [chartLabel, setChartLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [theme] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  // FIX: Provide a type and initial value for the useRef hook to resolve type errors.
  const scrollRef = useRef<HTMLElement>(null);
  // FIX: Provide a type for the useRef hook to resolve type errors.
  const progressInterval = useRef<number>();
  const isCustomMode = selectedMode === 'Custom';
  const isChartMode = selectedMode === 'Chart';
  const isCustomChartMode = isChartMode && chartMode === 'Custom';
  const hasSubMode = isCustomMode || isChartMode;

  const setTimecodes = ({timecodes}) =>
    setTimecodeList(
      timecodes.map((t) => ({...t, text: t.text.replaceAll("\\'", "'")})),
    );

  const onModeSelect = async (mode: keyof typeof modes) => {
    setActiveMode(mode);
    setIsLoading(true);
    setTimecodeList(null);
    setChartLabel(chartPrompt);

    // FIX: Use direct comparison on `mode` to enable type narrowing and fix call signature errors.
    const resp = await generateContent(
      mode === 'Custom'
        ? modes[mode].prompt(customPrompt)
        : mode === 'Chart'
        ? modes[mode].prompt(
            isCustomChartMode ? chartPrompt : modes[mode].subModes[chartMode],
          )
        : modes[mode].prompt,
      functions({
        set_timecodes: setTimecodes,
        set_timecodes_with_objects: setTimecodes,
        set_timecodes_with_numeric_values: ({timecodes}) =>
          setTimecodeList(timecodes),
      }),
      file,
    );

    const call = resp.functionCalls?.[0];

    if (call) {
      ({
        set_timecodes: setTimecodes,
        set_timecodes_with_objects: setTimecodes,
        set_timecodes_with_numeric_values: ({timecodes}) =>
          setTimecodeList(timecodes),
      })[call.name](call.args);
    }

    setIsLoading(false);
    // FIX: Add optional chaining to safely access 'current' which can be null.
    scrollRef.current?.scrollTo({top: 0});
  };

  const uploadVideo = async (e) => {
    e.preventDefault();
    if (isLoadingVideo) return;

    setIsLoadingVideo(true);
    setUploadProgress(0);
    setVideoError(false);
    setVidUrl(URL.createObjectURL(e.dataTransfer.files[0]));
    setTimecodeList(null);
    setActiveMode(null);

    // Simulate upload/processing progress
    progressInterval.current = window.setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 99) {
          clearInterval(progressInterval.current);
          return 99;
        }
        return prev + 1;
      });
    }, 200);

    const file = e.dataTransfer.files[0];

    try {
      const res = await uploadFile(file);
      setFile(res);
      clearInterval(progressInterval.current);
      setUploadProgress(100);
      setTimeout(() => setIsLoadingVideo(false), 500); // give time for 100% to show
    } catch (e) {
      setVideoError(true);
      clearInterval(progressInterval.current);
      setIsLoadingVideo(false);
    }
  };

  const handleDownloadSrt = () => {
    const srtContent = generateSrtContent(timecodeList, videoDuration);
    const blob = new Blob([srtContent], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captions.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className={theme}
      onDrop={uploadVideo}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => {}}
      onDragLeave={() => {}}>
      <section className="top">
        {vidUrl && !isLoadingVideo && (
          <>
            <div className={c('modeSelector', {hide: !showSidebar})}>
              {hasSubMode ? (
                <>
                  <div>
                    {isCustomMode ? (
                      <>
                        <h2>Custom prompt:</h2>
                        <textarea
                          placeholder="Type a custom prompt..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          // FIX: The 'rows' attribute should be a number.
                          rows={5}
                        />
                      </>
                    ) : (
                      <>
                        <h2>Chart this video by:</h2>

                        <div className="modeList">
                          {chartModes.map((mode) => (
                            <button
                              key={mode}
                              className={c('button', {
                                active: mode === chartMode,
                              })}
                              onClick={() => setChartMode(mode)}>
                              {mode}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className={c({active: isCustomChartMode})}
                          placeholder="Or type a custom prompt..."
                          value={chartPrompt}
                          onChange={(e) => setChartPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          onFocus={() => setChartMode('Custom')}
                          // FIX: The 'rows' attribute should be a number.
                          rows={2}
                        />
                      </>
                    )}
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}
                      disabled={
                        (isCustomMode && !customPrompt.trim()) ||
                        (isChartMode &&
                          isCustomChartMode &&
                          !chartPrompt.trim())
                      }>
                      ▶️ Generate
                    </button>
                  </div>
                  <div className="backButton">
                    <button
                      // FIX: Cast the value to the correct type for state update.
                      onClick={() =>
                        setSelectedMode(
                          Object.keys(modes)[0] as keyof typeof modes,
                        )
                      }>
                      <span className="icon">chevron_left</span>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2>Explore this video via:</h2>
                    <div className="modeList">
                      {Object.entries(modes).map(([mode, {emoji}]) => (
                        <button
                          key={mode}
                          className={c('button', {
                            active: mode === selectedMode,
                          })}
                          // FIX: Cast the value to the correct type for state update.
                          onClick={() =>
                            setSelectedMode(mode as keyof typeof modes)
                          }>
                          <span className="emoji">{emoji}</span> {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}>
                      ▶️ Generate
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              className="collapseButton"
              onClick={() => setShowSidebar(!showSidebar)}>
              <span className="icon">
                {showSidebar ? 'chevron_left' : 'chevron_right'}
              </span>
            </button>
          </>
        )}

        <VideoPlayer
          url={vidUrl}
          requestedTimecode={requestedTimecode}
          timecodeList={timecodeList}
          jumpToTimecode={setRequestedTimecode}
          isLoadingVideo={isLoadingVideo}
          videoError={videoError}
          uploadProgress={uploadProgress}
          onDurationChange={setVideoDuration}
        />
      </section>

      <div className={c('tools', {inactive: !vidUrl})}>
        {/* FIX: Assign the typed ref to the section element. */}
        <section
          className={c('output', {['mode' + activeMode]: activeMode})}
          ref={scrollRef}>
          {isLoading ? (
            <div className="loading">
              Waiting for model<span>...</span>
            </div>
          ) : (
            <>
              {(activeMode === 'A/V captions' || activeMode === 'Custom') &&
                timecodeList && (
                  <div className="exportOptions">
                    <button
                      onClick={handleDownloadSrt}
                      className="button download-button"
                      disabled={!videoDuration}>
                      <span className="icon">download</span>
                      Download .srt
                    </button>
                  </div>
                )}
              {timecodeList ? (
                activeMode === 'Table' ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Description</th>
                        <th>Objects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timecodeList.map(({time, text, objects}, i) => (
                        <tr
                          key={i}
                          role="button"
                          onClick={() =>
                            setRequestedTimecode(timeToSecs(time))
                          }>
                          <td>
                            <time>{time}</time>
                          </td>
                          <td>{text}</td>
                          <td>{objects.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeMode === 'Chart' ? (
                  <Chart
                    data={timecodeList}
                    yLabel={chartLabel}
                    jumpToTimecode={setRequestedTimecode}
                  />
                ) : // FIX: Check for activeMode and existence of 'isList' property to prevent runtime and type errors.
                activeMode &&
                'isList' in modes[activeMode] &&
                modes[activeMode].isList ? (
                  <ul>
                    {timecodeList.map(({time, text}, i) => (
                      <li key={i} className="outputItem">
                        <button
                          onClick={() =>
                            setRequestedTimecode(timeToSecs(time))
                          }>
                          <time>{time}</time>
                          <p className="text">{text}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  timecodeList.map(({time, text}, i) => (
                    <span
                      key={i}
                      className="sentence"
                      role="button"
                      onClick={() => setRequestedTimecode(timeToSecs(time))}>
                      <time>{time}</time>
                      <span>{text}</span>{' '}
                    </span>
                  ))
                )
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}