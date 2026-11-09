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
import { SankeyTransformedProps } from './types';
import Echart from '../components/Echart';

export default function Sankey(props: SankeyTransformedProps) {
  const { height, width, echartOptions, refs, formData } = props;
  const layoutMode = formData?.layout_mode ?? formData?.layoutMode ?? 'fit';
  const minWidth = Number(formData?.min_width ?? formData?.minWidth ?? 600);
  const isScrollable = layoutMode === 'scrollable';
  const targetWidth = isScrollable ? Math.max(width, minWidth) : width;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        overflowX: isScrollable ? 'auto' : 'hidden',
        overflowY: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <Echart
        refs={refs}
        height={height}
        width={targetWidth}
        echartOptions={echartOptions}
        vizType={formData.vizType}
      />
    </div>
  );
}
