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
import { useEffect, useRef, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Input,
  InputNumber,
  Select,
  Slider,
  Switch,
  Typography,
} from '@superset-ui/core/components';

export interface ParameterValue {
  name: string;
  value: string | number | boolean;
}

const Wrapper = styled.div`
  ${({ theme }) => css`
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const SliderRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

/**
 * A Tableau-style parameter control (`number`, `slider`, `select`, or `text`).
 * Publishes `{ name, value }` to widgets in its `customization` scope.
 */
export default function ParameterRenderer({
  props,
  setCustomizationValue,
}: canvasApi.CanvasWidgetProps) {
  const name = typeof props?.name === 'string' ? props.name : '';
  const label =
    typeof props?.label === 'string' && props.label
      ? props.label
      : name || t('Parameter');
  const inputType =
    props?.inputType === 'slider' ||
    props?.inputType === 'select' ||
    props?.inputType === 'text' ||
    props?.inputType === 'switch'
      ? props.inputType
      : 'number';
  const min = typeof props?.minValue === 'number' ? props.minValue : 0;
  const max = typeof props?.maxValue === 'number' ? props.maxValue : 1000000;
  const step = typeof props?.step === 'number' && props.step > 0 ? props.step : 1;
  const options = Array.isArray(props?.options)
    ? props.options.map(String)
    : [];
  const onValue: string | number | boolean =
    typeof props?.onValue === 'boolean' ||
    typeof props?.onValue === 'number' ||
    typeof props?.onValue === 'string'
      ? props.onValue
      : true;
  const offValue: string | number | boolean =
    typeof props?.offValue === 'boolean' ||
    typeof props?.offValue === 'number' ||
    typeof props?.offValue === 'string'
      ? props.offValue
      : false;
  const defaultRaw = props?.defaultValue;
  const initialValue: string | number | boolean =
    typeof defaultRaw === 'boolean' ||
    typeof defaultRaw === 'number' ||
    typeof defaultRaw === 'string'
      ? defaultRaw
      : inputType === 'switch'
        ? offValue
        : inputType === 'text' || inputType === 'select'
          ? ''
          : 0;

  const [value, setValue] = useState<string | number | boolean>(initialValue);
  const published = useRef(false);

  const publish = (next: string | number | boolean) => {
    if (!name) return;
    setCustomizationValue({ name, value: next });
  };

  useEffect(() => {
    if (published.current) return;
    published.current = true;
    publish(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: string | number | boolean) => {
    setValue(next);
    publish(next);
  };

  return (
    <Wrapper>
      <Typography.Text strong>{label}</Typography.Text>
      {inputType === 'slider' && (
        <SliderRow>
          <div style={{ flex: 1 }}>
            <Slider
              min={min}
              max={max}
              step={step}
              value={typeof value === 'number' ? value : Number(value) || min}
              onChange={val => {
                if (typeof val === 'number') update(val);
              }}
            />
          </div>
          <Typography.Text type="secondary">
            {Number(value).toLocaleString()}
          </Typography.Text>
        </SliderRow>
      )}
      {inputType === 'number' && (
        <InputNumber
          aria-label={label}
          min={typeof props?.minValue === 'number' ? props.minValue : undefined}
          max={typeof props?.maxValue === 'number' ? props.maxValue : undefined}
          step={step}
          value={typeof value === 'number' ? value : Number(value) || 0}
          style={{ width: '100%' }}
          onChange={val => {
            if (typeof val === 'number') update(val);
          }}
        />
      )}
      {inputType === 'select' && (
        <Select
          ariaLabel={label}
          options={options.map(opt => ({ label: opt, value: opt }))}
          value={String(value)}
          onChange={val => update(String(val ?? ''))}
        />
      )}
      {inputType === 'text' && (
        <Input
          aria-label={label}
          value={String(value)}
          onChange={e => update(e.target.value)}
        />
      )}
      {inputType === 'switch' && (
        <SliderRow>
          <Switch
            aria-label={label}
            checked={value === onValue || value === true}
            onChange={checked => update(checked ? onValue : offValue)}
          />
          <Typography.Text type="secondary">
            {String(value === onValue || value === true ? onValue : offValue)}
          </Typography.Text>
        </SliderRow>
      )}
    </Wrapper>
  );
}
