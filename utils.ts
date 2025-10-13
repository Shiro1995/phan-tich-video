/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export const timeToSecs = (timecode) => {
  const split = timecode.split(':').map(parseFloat);

  return split.length === 2
    ? split[0] * 60 + split[1]
    : split[0] * 3600 + split[1] * 60 + split[2];
};

export const secsToSrtTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  const milliseconds = Math.round(
    (totalSeconds - Math.floor(totalSeconds)) * 1000,
  )
    .toString()
    .padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

export const generateSrtContent = (timecodes, videoDuration) => {
  if (!timecodes || timecodes.length === 0) return '';
  return timecodes
    .map((tc, i) => {
      const startTimeSecs = timeToSecs(tc.time);
      const nextTc = timecodes[i + 1];
      const endTimeSecs = nextTc
        ? timeToSecs(nextTc.time)
        : videoDuration;

      const startTime = secsToSrtTime(startTimeSecs);
      const endTime = secsToSrtTime(endTimeSecs);

      return `${i + 1}\n${startTime} --> ${endTime}\n${tc.text}\n`;
    })
    .join('\n');
};
