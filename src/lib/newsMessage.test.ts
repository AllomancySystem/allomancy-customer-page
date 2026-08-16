import { isValidElement, type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';

import { substitutePlaceholders, linkifyToReact } from './newsMessage';

// --- helpers for asserting on the ReactNode array without a DOM render ---------

interface AnchorProps {
  href?: string;
  target?: string;
  rel?: string;
  children?: ReactNode;
  dangerouslySetInnerHTML?: unknown;
  [key: string]: unknown;
}

/** A node that is a real React <a> element (never a raw HTML string). */
function isAnchor(node: ReactNode): node is { type: 'a'; props: AnchorProps } & object {
  return isValidElement(node) && (node as { type: unknown }).type === 'a';
}

function anchors(nodes: ReactNode[]) {
  return nodes.filter(isAnchor) as Array<{ type: 'a'; props: AnchorProps }>;
}

function stringNodes(nodes: ReactNode[]): string[] {
  return nodes.filter((n): n is string => typeof n === 'string');
}

describe('substitutePlaceholders', () => {
  it('{username} → full display name, title-cased (split on whitespace and dots)', () => {
    expect(substitutePlaceholders('{username}', 'john.doe')).toBe('John Doe');
  });

  it('{name} → first name (part before the first dot), title-cased', () => {
    expect(substitutePlaceholders('{name}', 'john.doe')).toBe('John');
  });

  it('resolves both placeholders in one message', () => {
    expect(substitutePlaceholders('Hi {name}, welcome {username}!', 'john.doe')).toBe(
      'Hi John, welcome John Doe!',
    );
  });

  it('replaces every occurrence of each placeholder globally', () => {
    expect(substitutePlaceholders('{name} {name} {username} {username}', 'john.doe')).toBe(
      'John John John Doe John Doe',
    );
  });

  it('returns a message with no placeholders unchanged', () => {
    const msg = 'A plain announcement with no tokens.';
    expect(substitutePlaceholders(msg, 'john.doe')).toBe(msg);
  });

  it('title-cases mixed/upper input (only first letter of each part capitalized)', () => {
    expect(substitutePlaceholders('{username}', 'JOHN.DOE')).toBe('John Doe');
    expect(substitutePlaceholders('{name}', 'JOHN.DOE')).toBe('John');
  });

  it('fallback identity "resident" resolves both placeholders to "Resident"', () => {
    expect(substitutePlaceholders('{name}', 'resident')).toBe('Resident');
    expect(substitutePlaceholders('{username}', 'resident')).toBe('Resident');
  });

  it('is total over empty input: empty username yields empty substitutions, no throw', () => {
    expect(() => substitutePlaceholders('{name}/{username}', '')).not.toThrow();
    expect(substitutePlaceholders('{name}/{username}', '')).toBe('/');
  });
});

describe('linkifyToReact', () => {
  it('plain text with no links yields no link element and preserves the text', () => {
    const text = 'Just some ordinary prose without any links.';
    const nodes = linkifyToReact(text);
    expect(anchors(nodes)).toHaveLength(0);
    expect(stringNodes(nodes).join('')).toBe(text);
  });

  it('an https URL becomes an <a> with href, target=_blank, rel=noopener noreferrer', () => {
    const nodes = linkifyToReact('go https://example.com now');
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.props.href).toBe('https://example.com');
    expect(links[0]!.props.target).toBe('_blank');
    expect(links[0]!.props.rel).toBe('noopener noreferrer');
  });

  it('an http URL is linkified the same way', () => {
    const nodes = linkifyToReact('http://example.org');
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.props.href).toBe('http://example.org');
  });

  it('a bare email becomes a mailto: link', () => {
    const nodes = linkifyToReact('reach me@example.com please');
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.props.href).toBe('mailto:me@example.com');
  });

  it('trailing sentence punctuation is excluded from the link and kept as plain text', () => {
    const nodes = linkifyToReact('see https://example.com.');
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.props.href).toBe('https://example.com');
    // the period survives as plain text, not swallowed into the href
    expect(stringNodes(nodes).join('')).toContain('.');
    expect(stringNodes(nodes).some((s) => s.endsWith('.'))).toBe(true);
  });

  it('preserves text before and after a link, in order', () => {
    const nodes = linkifyToReact('before https://example.com after');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('before ');
    expect(isAnchor(nodes[1]!)).toBe(true);
    expect(nodes[2]).toBe(' after');
  });

  it('produces a separate <a> element for each of multiple links', () => {
    const nodes = linkifyToReact('a https://one.com b https://two.com c');
    const links = anchors(nodes);
    expect(links).toHaveLength(2);
    expect(links[0]!.props.href).toBe('https://one.com');
    expect(links[1]!.props.href).toBe('https://two.com');
  });

  // --- security / anti-XSS boundary ------------------------------------------

  it('no returned node carries dangerouslySetInnerHTML', () => {
    const nodes = linkifyToReact('text https://example.com and me@example.com more');
    for (const node of nodes) {
      if (isValidElement(node)) {
        expect((node.props as AnchorProps).dangerouslySetInnerHTML).toBeUndefined();
      }
    }
  });

  it('link nodes are real React <a> elements whose visible text is the matched token', () => {
    const nodes = linkifyToReact('visit https://example.com/path');
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.type).toBe('a');
    expect(links[0]!.props.children).toBe('https://example.com/path');
  });

  it('an injection-looking substring stays inert plain text (a string node, never an element/HTML)', () => {
    const nodes = linkifyToReact('<script>alert(1)</script> and https://ok.com');
    // exactly one real link, for the URL only
    const links = anchors(nodes);
    expect(links).toHaveLength(1);
    expect(links[0]!.props.href).toBe('https://ok.com');
    // the script tag is preserved verbatim as literal text and never becomes an element
    const strings = stringNodes(nodes);
    expect(strings.join('')).toContain('<script>alert(1)</script>');
    // no node is an element other than the single <a>
    const elements = nodes.filter((n) => isValidElement(n));
    expect(elements).toHaveLength(1);
    // and the script substring is a string, not an element
    expect(strings.some((s) => s.includes('<script>'))).toBe(true);
  });
});
