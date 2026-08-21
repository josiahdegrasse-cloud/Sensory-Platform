import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RangeScaleTicks } from './range-scale-ticks';

describe('RangeScaleTicks', () => {
  it('renders a tick label for every value on a 1–9 sensory scale', () => {
    const markup = renderToStaticMarkup(createElement(RangeScaleTicks, { min: 1, max: 9 }));

    expect(markup.match(/<span>[1-9]<\/span>/g)).toHaveLength(9);
  });

  it('respects non-unit steps', () => {
    const markup = renderToStaticMarkup(createElement(RangeScaleTicks, { min: 10, max: 20, step: 5 }));

    expect(markup).toContain('<span>10</span>');
    expect(markup).toContain('<span>15</span>');
    expect(markup).toContain('<span>20</span>');
  });
});
