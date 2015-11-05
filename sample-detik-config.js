'use strict';

// sample-detik-config.js - sample configuration file for cognicity-reports-detik module

/**
 * Configuration for cognicity-reports-powertrack
 * @namespace {object} config
 * @property {object} detik Configuration object for Detik web service interface
 * @property {string} detik.serviceURL The URL for the Detik web service, including topic ID and not including page number
 * @property {number} detik.pollInterval Poll interval for web service in milliseconds
 * @property {number} detik.historicalLoadPeriod Maximum age in milliseconds of reports which will be processed
 */
var config = {};

// Detik web service API
config.detik = {};
config.detik.serviceURL = "https://example.com/latest?topic=2"; // E.g. https://example.com/latest?topic=2
config.detik.pollInterval = 1000 * 60 * 5; // E.g. 1000 * 60 * 5 = 5min
config.detik.historicalLoadPeriod = 1000 * 60 * 60; // E.g. 1000 * 60 * 60 = 1hr

module.exports = config;
