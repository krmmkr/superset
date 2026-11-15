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
import { useEffect, useMemo, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Checkbox,
  Modal,
  Radio,
  Select,
  Switch,
  Typography,
} from '@superset-ui/core/components';
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';
import type { CanvasDefinitionResult } from './types';

type ScopeMode = 'auto' | 'global' | 'custom';

interface StoredScope {
  mode?: ScopeMode;
  targets?: string[];
  exclude?: string[];
}

interface SourceEntry {
  key: string;
  kind: canvasApi.ScopeKind;
  id: string;
  label: string;
}

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Checklist = styled.div`
  ${({ theme }) => css`
    max-height: 240px;
    overflow: auto;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;

    .ant-checkbox-group {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 1.5}px;
    }
  `}
`;

const Footer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const CONTAINER_TYPES = new Set([
  'tabs',
  'tab',
  'group',
  'filter.bar',
  'header',
  'filter.select',
  'filter.date_range',
  'parameter',
]);

const KIND_LABELS: Record<canvasApi.ScopeKind, string> = {
  filter: t('Filter'),
  crossFilter: t('Cross-Filter'),
  customization: t('Parameter'),
};

function nodeProps(
  result: CanvasDefinitionResult,
  nodeId: string,
): Record<string, unknown> | undefined {
  const node = result.definition?.nodes?.[nodeId];
  if (!node) return undefined;
  return node.widgetId ? result.widgets?.[node.widgetId]?.props : node.props;
}

function datasetIdOf(
  props: Record<string, unknown> | undefined,
): number | null {
  if (!props) return null;
  if (typeof props.datasetId === 'number') return props.datasetId;
  const binding = props.dataBinding as Record<string, unknown> | undefined;
  return typeof binding?.datasetId === 'number' ? binding.datasetId : null;
}

function targetBindsParam(
  props: Record<string, unknown> | undefined,
  paramName: string,
): boolean {
  if (!props || !paramName) return false;
  const chrome = props.chrome as Record<string, unknown> | undefined;
  if (
    chrome?.targetParam === paramName ||
    chrome?.timeGrainParam === paramName ||
    chrome?.dimensionParam === paramName ||
    chrome?.metricParam === paramName ||
    props.targetParam === paramName ||
    props.thresholdParam === paramName
  ) {
    return true;
  }
  const token = `{{${paramName}}}`;
  return ['message', 'content', 'label'].some(k => {
    const val = props[k];
    return typeof val === 'string' && val.includes(token);
  });
}

export interface ScopeMappingModalProps {
  open: boolean;
  onClose: () => void;
  result: CanvasDefinitionResult;
  draftToken: string;
  revision: number;
  onApplied: () => void;
}

export default function ScopeMappingModal({
  open,
  onClose,
  result,
  draftToken,
  revision,
  onApplied,
}: ScopeMappingModalProps) {
  const titles = result.titles ?? {};
  const interactions = result.definition?.interactions as
    | {
        filters?: Record<string, StoredScope>;
        crossFilters?: Record<string, StoredScope>;
        customizations?: Record<string, StoredScope>;
      }
    | undefined;

  const sources = useMemo<SourceEntry[]>(() => {
    const entries: SourceEntry[] = [];
    const collect = (
      kind: canvasApi.ScopeKind,
      resolved: Record<string, string[]> | undefined,
      stored: Record<string, StoredScope> | undefined,
    ) => {
      const ids = new Set([
        ...Object.keys(resolved ?? {}),
        ...Object.keys(stored ?? {}),
      ]);
      for (const id of ids) {
        const props = nodeProps(result, id);
        const suffix =
          kind === 'crossFilter' && props && !props.crossFilter
            ? ` [${t('Disabled on widget')}]`
            : '';
        const name = titles[id] || id;
        entries.push({
          key: `${kind}:${id}`,
          kind,
          id,
          label: `[${KIND_LABELS[kind]}] ${name}${suffix}`,
        });
      }
    };
    collect('filter', result.filterScopes, interactions?.filters);
    collect(
      'crossFilter',
      result.crossFilterScopes,
      interactions?.crossFilters,
    );
    collect(
      'customization',
      result.customizationScopes,
      interactions?.customizations,
    );
    return entries;
  }, [result, interactions, titles]);

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [crossFiltersEnabled, setCrossFiltersEnabled] = useState<boolean>(
    result.definition?.settings?.crossFilters?.enabled !== false,
  );
  const [mode, setMode] = useState<ScopeMode>('auto');
  const [checkedTargets, setCheckedTargets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const activeSource = useMemo(
    () => sources.find(s => s.key === selectedKey) ?? sources[0],
    [sources, selectedKey],
  );

  const candidateTargets = useMemo(() => {
    const out: { label: string; value: string; rank: number }[] = [];
    const srcProps = activeSource
      ? nodeProps(result, activeSource.id)
      : undefined;
    const srcDatasetId = datasetIdOf(srcProps);
    const paramName =
      activeSource?.kind === 'customization' &&
      typeof srcProps?.name === 'string'
        ? srcProps.name
        : '';

    for (const [id, widgetType] of Object.entries(result.widgetTypes ?? {})) {
      if (activeSource && id === activeSource.id) continue;
      if (CONTAINER_TYPES.has(widgetType)) continue;
      const tProps = nodeProps(result, id);
      let badge = '';
      let rank = 1;
      if (activeSource?.kind === 'customization' && paramName) {
        if (targetBindsParam(tProps, paramName)) {
          badge = ` — ${t('Bound')}`;
          rank = 0;
        }
      } else if (activeSource && srcDatasetId !== null) {
        const tDatasetId = datasetIdOf(tProps);
        if (tDatasetId === srcDatasetId) {
          badge = ` — ${t('Same dataset')}`;
          rank = 0;
        } else if (tDatasetId !== null) {
          badge = ` — ${t('Different dataset')}`;
          rank = 2;
        }
      }
      out.push({
        value: id,
        label: `${titles[id] || id} (${widgetType})${badge}`,
        rank,
      });
    }
    return out
      .sort((a, b) => a.rank - b.rank)
      .map(({ label, value }) => ({ label, value }));
  }, [result, titles, activeSource]);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setCrossFiltersEnabled(
      result.definition?.settings?.crossFilters?.enabled !== false,
    );
    if (!selectedKey && sources[0]) {
      setSelectedKey(sources[0].key);
    }
  }, [
    open,
    result.definition?.settings?.crossFilters?.enabled,
    selectedKey,
    sources,
  ]);

  useEffect(() => {
    if (!activeSource) return;
    const storedMap =
      activeSource.kind === 'filter'
        ? interactions?.filters
        : activeSource.kind === 'crossFilter'
          ? interactions?.crossFilters
          : interactions?.customizations;
    const stored = storedMap?.[activeSource.id];
    const nextMode: ScopeMode =
      stored?.mode === 'global' || stored?.mode === 'custom'
        ? stored.mode
        : 'auto';
    setMode(nextMode);
    if (nextMode === 'custom') {
      setCheckedTargets(stored?.targets ?? []);
    } else {
      const excluded = new Set(stored?.exclude ?? []);
      setCheckedTargets(
        candidateTargets.map(c => c.value).filter(id => !excluded.has(id)),
      );
    }
  }, [activeSource, interactions, candidateTargets]);

  const sendOps = async (ops: Record<string, unknown>[]) => {
    setSaving(true);
    setError(undefined);
    try {
      await SupersetClient.request({
        method: 'PATCH',
        endpoint: '/api/v1/canvas/draft',
        headers: {
          [DRAFT_TOKEN_HEADER]: draftToken,
        },
        jsonPayload: { revision, ops },
      });
      onApplied();
      onClose();
    } catch (e) {
      const { error: msg } = await getClientErrorObject(
        e as Parameters<typeof getClientErrorObject>[0],
      );
      setError(msg ?? t('Failed to update scope mapping'));
    } finally {
      setSaving(false);
    }
  };

  const handleApply = () => {
    const ops: Record<string, unknown>[] = [];
    const currentGlobal =
      result.definition?.settings?.crossFilters?.enabled !== false;
    if (crossFiltersEnabled !== currentGlobal) {
      ops.push({
        op: 'set_settings',
        key: 'crossFilters',
        value: { enabled: crossFiltersEnabled },
      });
    }
    if (activeSource) {
      const scope =
        mode === 'custom'
          ? { mode: 'custom', targets: checkedTargets }
          : {
              mode,
              exclude: candidateTargets
                .map(c => c.value)
                .filter(id => !checkedTargets.includes(id)),
            };
      ops.push({
        op: 'set_scope',
        kind: activeSource.kind,
        id: activeSource.id,
        scope,
      });
    }
    if (ops.length === 0) {
      onClose();
      return;
    }
    void sendOps(ops);
  };

  const handleReset = () => {
    if (!activeSource) return;
    void sendOps([
      {
        op: 'set_scope',
        kind: activeSource.kind,
        id: activeSource.id,
        scope: null,
      },
    ]);
  };

  return (
    <Modal
      show={open}
      onHide={onClose}
      title={t('Filter & Cross-Filter Scopes')}
      responsive
      footer={
        <Footer>
          {activeSource && (
            <Button onClick={handleReset} disabled={saving}>
              {t('Reset to Auto')}
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            {t('Cancel')}
          </Button>
          <Button buttonStyle="primary" onClick={handleApply} loading={saving}>
            {t('Apply')}
          </Button>
        </Footer>
      }
    >
      <Body>
        {error && <Alert type="error" message={error} showIcon />}
        <Row>
          <Typography.Text strong>
            {t('Enable Cross-Filtering on Canvas')}
          </Typography.Text>
          <Switch
            aria-label={t('Enable Cross-Filtering on Canvas')}
            checked={crossFiltersEnabled}
            onChange={setCrossFiltersEnabled}
          />
        </Row>
        {sources.length === 0 ? (
          <Typography.Text type="secondary">
            {t('No filters, cross-filters, or parameters are on this canvas.')}
          </Typography.Text>
        ) : (
          <>
            <div>
              <Typography.Text strong>{t('Source Control')}</Typography.Text>
              <Select
                ariaLabel={t('Source Control')}
                value={activeSource?.key}
                options={sources.map(s => ({ label: s.label, value: s.key }))}
                onChange={val => setSelectedKey(String(val))}
              />
            </div>
            <div>
              <Typography.Text strong>{t('Scope Mode')}</Typography.Text>
              <div>
                <Radio.Group
                  value={mode}
                  onChange={e => setMode(e.target.value as ScopeMode)}
                  options={[
                    { label: t('Auto (container)'), value: 'auto' },
                    { label: t('Global (all widgets)'), value: 'global' },
                    { label: t('Custom targets'), value: 'custom' },
                  ]}
                />
              </div>
            </div>
            <div>
              <Typography.Text strong>
                {mode === 'custom'
                  ? t('Target Widgets')
                  : t('Included Widgets (uncheck to exclude)')}
              </Typography.Text>
              <Checklist>
                <Checkbox.Group
                  options={candidateTargets}
                  value={checkedTargets}
                  onChange={vals => setCheckedTargets(vals.map(String))}
                />
              </Checklist>
            </div>
          </>
        )}
      </Body>
    </Modal>
  );
}
