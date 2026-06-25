/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import { S2TableFormData, S2TableChartProps } from './types';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

const metadata = new ChartMetadata({
  description:
    'A highly customizable flat list table powered by AntV S2 featuring native sorting, formatting, and alignment controls.',
  name: 'AntV S2 Flat Table (Custom)',
  thumbnail,
  thumbnailDark,
  behaviors: [Behavior.InteractiveChart],
  tags: ['Table', 'AntV S2', 'Custom', 'Flat Table'],
});

export default class AntvS2FlatTableChartPlugin extends ChartPlugin<
  S2TableFormData,
  S2TableChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./AntvS2Table'),
      metadata,
      transformProps,
    });
  }
}
