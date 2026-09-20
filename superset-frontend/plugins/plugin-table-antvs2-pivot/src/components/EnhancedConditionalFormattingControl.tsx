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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  Modal,
  Select,
  Input,
  InputNumber,
  Row,
  Col,
} from '@superset-ui/core/components';
import { EnhancedConditionalFormattingRule } from '../types';

export interface ColumnOption {
  label: string;
  value: string;
  isDimension?: boolean;
}

export interface EnhancedConditionalFormattingControlProps {
  value?: EnhancedConditionalFormattingRule[];
  onChange?: (value: EnhancedConditionalFormattingRule[]) => void;
  columnOptions?: ColumnOption[];
}

const PRESET_COLORS = [
  '#ff4d4f', // Red
  '#faad14', // Yellow / Alert
  '#52c41a', // Green / Success
  '#1890ff', // Blue
  '#722ed1', // Purple
  '#13c2c2', // Cyan
  '#eb2f96', // Pink
  '#595959', // Gray
  '#ffffff', // White
  '#000000', // Black
];

const METRIC_OPERATOR_OPTIONS = [
  { value: '>', label: '> (Greater than)' },
  { value: '>=', label: '>= (Greater than or equal)' },
  { value: '<', label: '< (Less than)' },
  { value: '<=', label: '<= (Less than or equal)' },
  { value: '=', label: '= (Equal to)' },
  { value: '!=', label: '!= (Not equal to)' },
  { value: 'between', label: 'between (Range)' },
];

const DIMENSION_OPERATOR_OPTIONS = [
  { value: '=', label: '= (Exact Match)' },
  { value: '!=', label: '!= (Does Not Equal)' },
  { value: 'contains', label: 'contains (Includes Text)' },
  { value: 'starts_with', label: 'starts_with (Begins With)' },
];

function hexToRgba(color: string, opacity = 1): string {
  if (!color) return `rgba(0, 0, 0, ${opacity})`;
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    return color;
  }
  let clean = color.replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map(c => c + c)
      .join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function EnhancedConditionalFormattingControl({
  value = [],
  onChange,
  columnOptions = [],
}: EnhancedConditionalFormattingControlProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form states
  const [targetColumn, setTargetColumn] = useState<string>(
    columnOptions[0]?.value || '',
  );
  const [ruleType, setRuleType] = useState<'threshold' | 'colorScale'>('threshold');
  const [operator, setOperator] = useState<
    | '>'
    | '<'
    | '>='
    | '<='
    | '='
    | '!='
    | 'between'
    | 'contains'
    | 'starts_with'
  >('>');
  const [compareTarget, setCompareTarget] = useState<'static' | 'column'>('static');
  const [targetValue, setTargetValue] = useState<number>(0);
  const [targetValueRight, setTargetValueRight] = useState<number>(100);
  const [targetValueText, setTargetValueText] = useState<string>('');
  const [targetColumnCompare, setTargetColumnCompare] = useState<string>(
    columnOptions[1]?.value || columnOptions[0]?.value || '',
  );
  const [color, setColor] = useState<string>('#52c41a');
  const [opacity, setOpacity] = useState<number>(1);
  const [applyTo, setApplyTo] = useState<'background' | 'text' | 'icon'>('background');
  const [iconName, setIconName] = useState<string>('arrow-up');
  const [iconPosition, setIconPosition] = useState<'left' | 'right'>('left');
  const [customPrefix, setCustomPrefix] = useState<string>('');
  const [minColor, setMinColor] = useState<string>('#e6f7ff');
  const [maxColor, setMaxColor] = useState<string>('#1890ff');
  const [minOpacity, setMinOpacity] = useState<number>(0.3);
  const [maxOpacity, setMaxOpacity] = useState<number>(1);

  const selectedColObj = columnOptions.find(o => o.value === targetColumn);
  const isDimension = selectedColObj?.isDimension ?? false;

  const handleTargetColumnChange = (newCol: string) => {
    setTargetColumn(newCol);
    const newColObj = columnOptions.find(o => o.value === newCol);
    if (newColObj?.isDimension) {
      setRuleType('threshold');
      setOperator('=');
    } else {
      setOperator('>');
    }
  };

  const openAddModal = () => {
    setEditingRuleId(null);
    const defaultCol = columnOptions[0]?.value || '';
    const defaultColObj = columnOptions[0];
    setTargetColumn(defaultCol);
    setRuleType('threshold');
    setOperator(defaultColObj?.isDimension ? '=' : '>');
    setCompareTarget('static');
    setTargetValue(0);
    setTargetValueRight(100);
    setTargetValueText('');
    setTargetColumnCompare(columnOptions[1]?.value || defaultCol);
    setColor('#52c41a');
    setOpacity(1);
    setApplyTo('background');
    setIconName('arrow-up');
    setIconPosition('left');
    setCustomPrefix('');
    setMinColor('#e6f7ff');
    setMaxColor('#1890ff');
    setMinOpacity(0.3);
    setMaxOpacity(1);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: EnhancedConditionalFormattingRule) => {
    setEditingRuleId(rule.id);
    setTargetColumn(rule.column);
    setRuleType(rule.ruleType);
    if (rule.ruleType === 'threshold') {
      setOperator(rule.operator || '>');
      setCompareTarget(rule.compareTarget || 'static');
      setTargetValue(rule.targetValue ?? 0);
      setTargetValueRight(rule.targetValueRight ?? 100);
      setTargetValueText(rule.targetValueText ?? '');
      setTargetColumnCompare(rule.targetColumn || columnOptions[0]?.value || '');
      setColor(rule.color || '#52c41a');
      setOpacity(rule.opacity ?? 1);
      setApplyTo(rule.applyTo || 'background');
      setIconName(rule.iconName || 'arrow-up');
      setIconPosition(rule.iconPosition || 'left');
      setCustomPrefix(rule.customPrefix || '');
    } else {
      setMinColor(rule.minColor || '#e6f7ff');
      setMaxColor(rule.maxColor || '#1890ff');
      setMinOpacity(rule.minOpacity ?? 0.3);
      setMaxOpacity(rule.maxOpacity ?? 1);
    }
    setIsModalOpen(true);
  };

  const handleDeleteRule = (id: string) => {
    const updated = value.filter(r => r.id !== id);
    onChange?.(updated);
  };

  const handleSaveRule = () => {
    const newRule: EnhancedConditionalFormattingRule = {
      id: editingRuleId || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      column: targetColumn,
      ruleType,
      ...(ruleType === 'threshold'
        ? {
            operator,
            compareTarget,
            ...(compareTarget === 'static'
              ? isDimension
                ? { targetValueText }
                : {
                    targetValue,
                    ...(operator === 'between' ? { targetValueRight } : {}),
                  }
              : {
                  targetColumn: targetColumnCompare,
                }),
            color,
            opacity,
            applyTo,
            ...(applyTo === 'icon'
              ? {
                  iconName,
                  iconPosition,
                  ...(iconName === 'custom' ? { customPrefix } : {}),
                }
              : {}),
          }
        : {
            minColor,
            maxColor,
            minOpacity,
            maxOpacity,
          }),
    };

    let updated: EnhancedConditionalFormattingRule[];
    if (editingRuleId) {
      updated = value.map(r => (r.id === editingRuleId ? newRule : r));
    } else {
      updated = [...value, newRule];
    }

    onChange?.(updated);
    setIsModalOpen(false);
  };

  const getIconSymbol = (name?: string, prefix?: string) => {
    switch (name) {
      case 'arrow-up':
        return '▲';
      case 'arrow-down':
        return '▼';
      case 'trend-up':
        return '↑';
      case 'trend-down':
        return '↓';
      case 'circle-fill':
        return '●';
      case 'check':
        return '✔';
      case 'cross':
        return '✖';
      case 'custom':
        return prefix || '★';
      default:
        return '▲';
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Rule List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        {value.length === 0 && (
          <div style={{ fontSize: '12px', color: '#8c8c8c', fontStyle: 'italic' }}>
            {t('No conditional formatting rules configured.')}
          </div>
        )}
        {value.map(rule => {
          const ruleOpacity = rule.opacity ?? 1;
          const previewColor = hexToRgba(rule.color || '#52c41a', ruleOpacity);

          return (
            <div
              key={rule.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: '#fafafa',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                {/* Color / Icon swatch preview */}
                {rule.ruleType === 'threshold' ? (
                  rule.applyTo === 'icon' ? (
                    <span
                      style={{
                        fontSize: '13px',
                        color: rule.color || '#52c41a',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {getIconSymbol(rule.iconName, rule.customPrefix)}
                    </span>
                  ) : (
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        backgroundColor: previewColor,
                        border: '1px solid rgba(0,0,0,0.15)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                  )
                ) : (
                  <span
                    style={{
                      width: '28px',
                      height: '14px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, ${hexToRgba(rule.minColor || '#e6f7ff', rule.minOpacity ?? 0.3)}, ${hexToRgba(rule.maxColor || '#1890ff', rule.maxOpacity ?? 1)})`,
                      border: '1px solid rgba(0,0,0,0.15)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span style={{ fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {rule.column}
                </span>
                <span style={{ color: '#595959', fontSize: '11px' }}>
                  {rule.ruleType === 'threshold' ? (
                    rule.compareTarget === 'column' ? (
                      `${rule.operator} ${rule.targetColumn} (${rule.applyTo === 'icon' ? `Icon ${rule.iconPosition === 'right' ? 'Suffix' : 'Prefix'}` : rule.applyTo === 'text' ? 'Text' : 'Bg'}${ruleOpacity < 1 ? `, ${Math.round(ruleOpacity * 100)}%` : ''})`
                    ) : rule.operator === 'between' ? (
                      `${rule.targetValue} - ${rule.targetValueRight} (${rule.applyTo === 'icon' ? `Icon ${rule.iconPosition === 'right' ? 'Suffix' : 'Prefix'}` : rule.applyTo === 'text' ? 'Text' : 'Bg'}${ruleOpacity < 1 ? `, ${Math.round(ruleOpacity * 100)}%` : ''})`
                    ) : rule.targetValueText !== undefined && rule.targetValueText !== '' ? (
                      `${rule.operator} "${rule.targetValueText}" (${rule.applyTo === 'icon' ? `Icon ${rule.iconPosition === 'right' ? 'Suffix' : 'Prefix'}` : rule.applyTo === 'text' ? 'Text' : 'Bg'}${ruleOpacity < 1 ? `, ${Math.round(ruleOpacity * 100)}%` : ''})`
                    ) : (
                      `${rule.operator} ${rule.targetValue} (${rule.applyTo === 'icon' ? `Icon ${rule.iconPosition === 'right' ? 'Suffix' : 'Prefix'}` : rule.applyTo === 'text' ? 'Text' : 'Bg'}${ruleOpacity < 1 ? `, ${Math.round(ruleOpacity * 100)}%` : ''})`
                    )
                  ) : (
                    `Color Scale (${Math.round((rule.minOpacity ?? 0.3) * 100)}% - ${Math.round((rule.maxOpacity ?? 1) * 100)}%)`
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => openEditModal(rule)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#1890ff',
                    padding: '2px 4px',
                    fontSize: '11px',
                  }}
                >
                  {t('Edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ff4d4f',
                    padding: '2px 4px',
                    fontSize: '11px',
                  }}
                >
                  {t('Delete')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        buttonStyle="secondary"
        buttonSize="small"
        onClick={openAddModal}
        style={{ width: '100%' }}
      >
        + {t('Add Formatting Rule')}
      </Button>

      <Modal
        title={editingRuleId ? t('Edit Formatting Rule') : t('Add Formatting Rule')}
        show={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        onHandledPrimaryAction={handleSaveRule}
        primaryButtonName={t('Save Rule')}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>
          {/* Target Column */}
          <div>
            <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              {t('Target Column / Metric')}
            </label>
            <div style={{ width: '100%' }}>
              <Select
                value={targetColumn}
                onChange={val => handleTargetColumnChange(String(val))}
                options={columnOptions}
              />
            </div>
          </div>

          {/* Rule Type */}
          <div>
            <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              {t('Rule Type')}
            </label>
            <div style={{ width: '100%' }}>
              <Select
                value={ruleType}
                onChange={val => setRuleType(val as 'threshold' | 'colorScale')}
                options={
                  isDimension
                    ? [{ value: 'threshold', label: t('Threshold / Comparison (Dimension)') }]
                    : [
                        { value: 'threshold', label: t('Threshold / Comparison') },
                        { value: 'colorScale', label: t('Color Scale (Heatmap Gradient)') },
                      ]
                }
              />
            </div>
          </div>

          {ruleType === 'threshold' && (
            <>
              {/* Compare Target */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {t('Compare Against')}
                </label>
                <div style={{ width: '100%' }}>
                  <Select
                    value={compareTarget}
                    onChange={val => setCompareTarget(val as 'static' | 'column')}
                    options={[
                      {
                        value: 'static',
                        label: isDimension
                          ? t('Static Text Value')
                          : t('Static Number Value'),
                      },
                      {
                        value: 'column',
                        label: t('Another Column (Dynamic Comparison)'),
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Operator & Value */}
              <Row gutter={10} align="middle">
                <Col span={compareTarget === 'column' ? 8 : operator === 'between' ? 6 : 8}>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    {t('Condition')}
                  </label>
                  <Select
                    value={operator}
                    onChange={val => setOperator(val as any)}
                    options={
                      isDimension
                        ? DIMENSION_OPERATOR_OPTIONS
                        : compareTarget === 'column'
                          ? METRIC_OPERATOR_OPTIONS.filter(o => o.value !== 'between')
                          : METRIC_OPERATOR_OPTIONS
                    }
                  />
                </Col>

                {compareTarget === 'static' ? (
                  isDimension ? (
                    <Col span={16}>
                      <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('Text / Value')}
                      </label>
                      <Input
                        value={targetValueText}
                        onChange={e => setTargetValueText(e.target.value)}
                        placeholder="e.g. East, Technology"
                      />
                    </Col>
                  ) : operator === 'between' ? (
                    <>
                      <Col span={9}>
                        <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          {t('Min Value')}
                        </label>
                        <InputNumber
                          value={targetValue}
                          onChange={val => setTargetValue(Number(val) || 0)}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={9}>
                        <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          {t('Max Value')}
                        </label>
                        <InputNumber
                          value={targetValueRight}
                          onChange={val => setTargetValueRight(Number(val) || 0)}
                          style={{ width: '100%' }}
                        />
                      </Col>
                    </>
                  ) : (
                    <Col span={16}>
                      <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('Value')}
                      </label>
                      <InputNumber
                        value={targetValue}
                        onChange={val => setTargetValue(Number(val) || 0)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  )
                ) : (
                  <Col span={16}>
                    <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                      {t('Compare Column')}
                    </label>
                    <Select
                      value={targetColumnCompare}
                      onChange={val => setTargetColumnCompare(String(val))}
                      options={columnOptions.filter(o => o.value !== targetColumn)}
                    />
                  </Col>
                )}
              </Row>

              {/* Format Target */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {t('Apply To')}
                </label>
                <div style={{ width: '100%' }}>
                  <Select
                    value={applyTo}
                    onChange={val => setApplyTo(val as 'background' | 'text' | 'icon')}
                    options={[
                      { value: 'background', label: t('Background Color') },
                      { value: 'text', label: t('Text Color') },
                      { value: 'icon', label: t('Icon / Arrow Indicator') },
                    ]}
                  />
                </div>
              </div>

              {/* Icon Configuration when applyTo === 'icon' */}
              {applyTo === 'icon' && (
                <Row gutter={10}>
                  <Col span={12}>
                    <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                      {t('Icon / Symbol')}
                    </label>
                    <div style={{ width: '100%' }}>
                      <Select
                        value={iconName}
                        onChange={val => setIconName(String(val))}
                        options={[
                          { value: 'arrow-up', label: '▲ Solid Triangle Up' },
                          { value: 'arrow-down', label: '▼ Solid Triangle Down' },
                          { value: 'trend-up', label: '↑ Linear Arrow Up' },
                          { value: 'trend-down', label: '↓ Linear Arrow Down' },
                          { value: 'circle-fill', label: '● Dot / Circle' },
                          { value: 'check', label: '✔ Checkmark' },
                          { value: 'cross', label: '✖ Cross' },
                          { value: 'custom', label: t('Custom Symbol / Prefix') },
                        ]}
                      />
                    </div>
                  </Col>

                  <Col span={12}>
                    <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                      {t('Position')}
                    </label>
                    <div style={{ width: '100%' }}>
                      <Select
                        value={iconPosition}
                        onChange={val => setIconPosition(val as 'left' | 'right')}
                        options={[
                          { value: 'left', label: t('Prefix (Left)') },
                          { value: 'right', label: t('Suffix (Right)') },
                        ]}
                      />
                    </div>
                  </Col>

                  {iconName === 'custom' && (
                    <Col span={24} style={{ marginTop: '8px' }}>
                      <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('Custom Prefix / Symbol')}
                      </label>
                      <Input
                        value={customPrefix}
                        onChange={e => setCustomPrefix(e.target.value)}
                        placeholder="e.g. $, +, ▲, ★"
                      />
                    </Col>
                  )}
                </Row>
              )}

              {/* Color Picker & Swatches */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {applyTo === 'icon' ? t('Icon Color') : t('Color')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#52c41a'}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: '36px',
                      height: '32px',
                      padding: 0,
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  />
                  <Input
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    placeholder="#52c41a"
                    style={{ flex: 1 }}
                  />
                  {/* Opacity preview swatch */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      backgroundColor: hexToRgba(color, opacity),
                      border: '1px solid #bfbfbf',
                    }}
                    title={`Preview: ${Math.round(opacity * 100)}% opacity`}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '3px',
                        backgroundColor: c,
                        cursor: 'pointer',
                        border: color === c ? '2px solid #000' : '1px solid #d9d9d9',
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Single Transparency / Opacity Slider (No duplicate quick buttons) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>
                    {t('Transparency / Opacity')}
                  </label>
                  <span style={{ fontSize: '12px', color: '#595959', fontWeight: 500 }}>
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(opacity * 100)}
                  onChange={e => setOpacity(Number(e.target.value) / 100)}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </>
          )}

          {ruleType === 'colorScale' && (
            <>
              {/* Color Scale Min & Max */}
              <Row gutter={16}>
                <Col span={12}>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    {t('Min Value Color (Lowest)')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={minColor.startsWith('#') ? minColor : '#e6f7ff'}
                      onChange={e => setMinColor(e.target.value)}
                      style={{
                        width: '36px',
                        height: '32px',
                        padding: 0,
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                    <Input
                      value={minColor}
                      onChange={e => setMinColor(e.target.value)}
                      placeholder="#e6f7ff"
                      style={{ flex: 1 }}
                    />
                  </div>
                </Col>

                <Col span={12}>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    {t('Max Value Color (Highest)')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={maxColor.startsWith('#') ? maxColor : '#1890ff'}
                      onChange={e => setMaxColor(e.target.value)}
                      style={{
                        width: '36px',
                        height: '32px',
                        padding: 0,
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                    <Input
                      value={maxColor}
                      onChange={e => setMaxColor(e.target.value)}
                      placeholder="#1890ff"
                      style={{ flex: 1 }}
                    />
                  </div>
                </Col>
              </Row>

              {/* Clean Opacity sliders for color scale (No duplicate quick buttons) */}
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontWeight: 600, fontSize: '12px' }}>
                      {t('Min Opacity')}
                    </label>
                    <span style={{ fontSize: '12px', color: '#595959' }}>
                      {Math.round(minOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(minOpacity * 100)}
                    onChange={e => setMinOpacity(Number(e.target.value) / 100)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </Col>
                <Col span={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontWeight: 600, fontSize: '12px' }}>
                      {t('Max Opacity')}
                    </label>
                    <span style={{ fontSize: '12px', color: '#595959' }}>
                      {Math.round(maxOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(maxOpacity * 100)}
                    onChange={e => setMaxOpacity(Number(e.target.value) / 100)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </Col>
              </Row>

              {/* Gradient Preview */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {t('Gradient Preview')}
                </label>
                <div
                  style={{
                    height: '24px',
                    borderRadius: '4px',
                    background: `linear-gradient(to right, ${hexToRgba(minColor, minOpacity)}, ${hexToRgba(maxColor, maxOpacity)})`,
                    border: '1px solid #d9d9d9',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
