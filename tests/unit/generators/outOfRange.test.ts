/**
 * Coverage Fix — Generator out-of-range branch tests
 *
 * Each generator has an early-return RangeError check: `if (index < 0 || index >= totalItems)`.
 * Testing this branch in a few representative generators covers the uncovered line 113
 * in AndroidEndpointGenerator and similar lines in other generators.
 */

import { describe, it, expect } from 'vitest';
import { AndroidEndpointGenerator } from '../../../src/generators/AndroidEndpointGenerator';
import { LinuxEndpointGenerator } from '../../../src/generators/LinuxEndpointGenerator';
import { MacEndpointGenerator } from '../../../src/generators/MacEndpointGenerator';
import { SoftwareGenerator } from '../../../src/generators/SoftwareGenerator';
import { WindowsUpdatesGenerator } from '../../../src/generators/WindowsUpdatesGenerator';
import { IndustrialEndpointGenerator } from '../../../src/generators/IndustrialEndpointGenerator';
import { IosEndpointGenerator } from '../../../src/generators/IosEndpointGenerator';
import { NetworkEndpointGenerator } from '../../../src/generators/NetworkEndpointGenerator';

describe('Generator out-of-range protection', () => {
  it('AndroidEndpointGenerator throws RangeError for negative index', () => {
    const gen = new AndroidEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('AndroidEndpointGenerator throws RangeError for index >= totalItems', () => {
    const gen = new AndroidEndpointGenerator();
    expect(() => gen.generateItem(gen.totalItems)).toThrow(RangeError);
  });

  it('LinuxEndpointGenerator throws RangeError for negative index', () => {
    const gen = new LinuxEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('LinuxEndpointGenerator throws RangeError for index >= totalItems', () => {
    const gen = new LinuxEndpointGenerator();
    expect(() => gen.generateItem(gen.totalItems)).toThrow(RangeError);
  });

  it('MacEndpointGenerator throws RangeError for negative index', () => {
    const gen = new MacEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('SoftwareGenerator throws RangeError for negative index', () => {
    const gen = new SoftwareGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('WindowsUpdatesGenerator throws RangeError for negative index', () => {
    const gen = new WindowsUpdatesGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('AndroidEndpointGenerator generates valid item at index 0', () => {
    const gen = new AndroidEndpointGenerator();
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('displayName');
  });

  it('IndustrialEndpointGenerator throws RangeError for negative index', () => {
    const gen = new IndustrialEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('IndustrialEndpointGenerator throws RangeError for index >= totalItems', () => {
    const gen = new IndustrialEndpointGenerator();
    expect(() => gen.generateItem(gen.totalItems)).toThrow(RangeError);
  });

  it('IosEndpointGenerator throws RangeError for negative index', () => {
    const gen = new IosEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('NetworkEndpointGenerator throws RangeError for negative index', () => {
    const gen = new NetworkEndpointGenerator();
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });
});
