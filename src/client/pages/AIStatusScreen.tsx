import React, { useState, useEffect } from 'react';
import { aiService } from '@client/services/aiService';
import type { AIStatus } from '@client/services/aiService';
import styles from '@client/styles/AIStatusScreen.module.scss';

interface MemoryStats {
  numTensors: number;
  numDataBuffers: number;
  numBytes: number;
}

export const AIStatusScreen: React.FC = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [memory, setMemory] = useState<MemoryStats | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const s = await aiService.getStatus();
      setStatus(s);
      setMemory(aiService.getMemoryStats());
    };

    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  const dotState = !status
    ? 'loading'
    : status.initialized && status.embeddingsReady
      ? 'ready'
      : status.initialized
        ? 'indexing'
        : 'loading';

  const statusLabel = !status
    ? 'Loading...'
    : status.embeddingsReady
      ? 'Ready'
      : status.initialized
        ? 'Indexing...'
        : 'Loading...';

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Engine</h1>
        <div className={styles.statusBadge} data-state={dotState}>
          <span className={styles.dot} />
          {statusLabel}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Engine Status</h2>

        <div className={styles.table}>
          <div className={styles.row}>
            <span className={styles.key}>initialized</span>
            <span className={styles.value} data-bool={String(status?.initialized ?? false)}>
              {String(status?.initialized ?? false)}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>embeddingsReady</span>
            <span className={styles.value} data-bool={String(status?.embeddingsReady ?? false)}>
              {String(status?.embeddingsReady ?? false)}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>usingFullModel</span>
            <span className={styles.value} data-bool={String(status?.usingFullModel ?? false)}>
              {String(status?.usingFullModel ?? false)}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>model</span>
            <span className={styles.value}>
              {status?.usingFullModel ? 'Sentence Transformer' : 'TF.js Fallback'}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>serviceCount</span>
            <span className={styles.value}>{status?.serviceCount ?? '—'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>embeddingCount</span>
            <span className={styles.value}>{status?.embeddingCount ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>tf.memory()</h2>

        <div className={styles.table}>
          <div className={styles.row}>
            <span className={styles.key}>numTensors</span>
            <span className={styles.value}>{memory?.numTensors ?? '—'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>numDataBuffers</span>
            <span className={styles.value}>{memory?.numDataBuffers ?? '—'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>numBytes</span>
            <span className={styles.value}>
              {memory ? `${(memory.numBytes / 1024).toFixed(1)} KB` : '—'}
            </span>
          </div>
        </div>
      </section>

      <p className={styles.hint}>Refreshes every 3s</p>
    </main>
  );
};
