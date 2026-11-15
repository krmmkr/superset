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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Button, Input, Modal, Typography } from '@superset-ui/core/components';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';

export interface CssEditorModalProps {
  show: boolean;
  canvasId: number;
  initialCss: string;
  onSaved: (nextCss: string) => void;
  onHide: () => void;
}

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const CssTextArea = styled(Input.TextArea)`
  ${({ theme }) => css`
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export default function CssEditorModal({
  show,
  canvasId,
  initialCss,
  onSaved,
  onHide,
}: CssEditorModalProps) {
  const [cssText, setCssText] = useState(initialCss);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setCssText(initialCss);
      setError(null);
    }
  }, [show, initialCss]);

  const handleChange = (value: string) => {
    setCssText(value);
    injectCustomCss(value);
  };

  const handleCancel = () => {
    injectCustomCss(initialCss);
    onHide();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/canvas/${canvasId}`,
        jsonPayload: { css: cssText },
      });
      injectCustomCss(cssText);
      onSaved(cssText);
      onHide();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Failed to save canvas CSS'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      title={t('Edit canvas CSS')}
      width={640}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            onClick={handleCancel}
            disabled={saving}
            data-test="canvas-css-cancel"
          >
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            onClick={handleSave}
            loading={saving}
            data-test="canvas-css-save"
          >
            {t('Save CSS')}
          </Button>
        </>
      }
    >
      <Body>
        <Typography.Text type="secondary">
          {t(
            'Custom CSS applies to this canvas immediately as a live preview. Use CSS variables or theme-safe rgba() colors so styles adapt cleanly in light and dark mode.',
          )}
        </Typography.Text>
        {error && <Alert type="error" message={error} showIcon />}
        <CssTextArea
          rows={12}
          value={cssText}
          onChange={e => handleChange(e.target.value)}
          placeholder={`.canvas-widget {\n  border-radius: 10px;\n}`}
          data-test="canvas-css-textarea"
        />
      </Body>
    </Modal>
  );
}
