'use strict';

// sample-detik-config.js - sample configuration file for cognicity-reports-detik module

/**
 * Configuration for cognicity-reports-detik
 * @namespace {object} config
 * @property {object} detik Configuration object for Detik web service interface
 * @property {string} detik.serviceURL The URL for the Detik web service, including topic ID and not including page number
 * @property {number} detik.pollInterval Poll interval for web service in milliseconds
 * @property {number} detik.historicalLoadPeriod Maximum age in milliseconds of reports which will be processed
 * @property {object} detik.pg Postgres database configuration options
 * @property {string} detik.pg.table_detik Database table used to store Detik reports
 * @property {string} detik.pg.table_detik_users Database table used to store Detik counts per user
 */
var config = {};

// Detik web service API
config.detik = {};
config.detik.serviceURL = "https://example.com/latest?topic=2"; // E.g. https://example.com/latest?topic=2
config.detik.pollInterval = 1000 * 60 * 5; // E.g. 1000 * 60 * 5 = 5min
config.detik.historicalLoadPeriod = 1000 * 60 * 60; // E.g. 1000 * 60 * 60 = 1hr

// Detik configuration for cognicity-schema
config.detik.pg = {};
config.detik.pg.table_detik = 'detik_reports';
config.detik.pg.table_detik_users = 'detik_users';

module.exports = config;
