#!/usr/bin/env node
/**
 * bConnect Mock Server — CLI Entry Point
 *
 * Thin wrapper that forwards to the main index entry point so that
 * the `bconnect-mock` binary (defined in package.json "bin") works
 * the same way as `node build/index.js`.
 */

import './index';
