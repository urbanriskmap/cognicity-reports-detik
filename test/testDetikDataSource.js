'use strict';

/* jshint -W079 */ // Ignore this error for this import only, as we get a redefinition problem
var test = require('unit.js');
/* jshint +W079 */
var DetikDataSource = require('../DetikDataSource');

// Mock reports
var reports = {
	config: {},
	logger: {},
	tweetAdmin: function(){}
};

// Mock result
var result = {
	location:{
		geospatial:{
			longitude:0,
			latitude:0
		}
	}
};

// Create server with empty objects
// We will mock these objects as required for each test suite
var detikDataSource = new DetikDataSource(
	reports,
	{
		detik: {}
	}
);

// Mocked logger we can use to let code run without error when trying to call logger messages
detikDataSource.logger = {
	error:function(){},
	warn:function(){},
	info:function(){},
	verbose:function(){},
	debug:function(){}
};
detikDataSource.reports.logger = detikDataSource.logger;

// Test harness for CognicityReportsPowertrack object
describe( 'DetikDataSource', function() {

	describe( "constructor", function() {

		it( 'Config is merged from reports with data source', function() {
			var dds = new DetikDataSource(
				{
					config: {
						jupiter: "europa"
					}
				},
				{
					saturn: "enceladus"
				}
			);

			test.value( dds.config.jupiter ).is( 'europa' );
			test.value( dds.config.saturn ).is( 'enceladus' );
		});

	});

	describe( "cacheMode", function() {
		beforeEach( function() {
			detikDataSource._cachedData = [];
			detikDataSource._cacheMode = false;
		});

		it( 'Realtime processing is enabled by default', function() {
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Enabling caching mode stops realtime filtering and retains tweets', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 1 );
		});

		it( 'Disabling caching mode reenables realtime filtering', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource.disableCacheMode(); // Stop cache mode
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Cached tweets are processed when caching mode is disabled', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 1 );
			detikDataSource.disableCacheMode(); // Stop cache mode
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Multiple tweet handling', function() {
			detikDataSource._processResult(result);
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 0 );
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._processResult(result);
			detikDataSource._processResult(result);
			detikDataSource._processResult(result);
			test.value( detikDataSource._cachedData.length ).is( 3 );
			detikDataSource.disableCacheMode(); // Stop cache mode
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

	});

	describe( "start", function() {
		var oldPoll;
		var pollCalledTimes;
		var oldSetInterval;
		var testInterval;
		var oldUpdateLastContributionIdFromDatabase;

		before( function() {
			oldPoll = detikDataSource._poll;
			oldSetInterval = setInterval;
			oldUpdateLastContributionIdFromDatabase = detikDataSource._updateLastContributionIdFromDatabase;
			detikDataSource._updateLastContributionIdFromDatabase = function(){};
			detikDataSource._poll = function() {
				pollCalledTimes++;
			};
			/* jshint -W020 */ // We want to mock out a global function here
			/* global setInterval:true */
			setInterval = function( callback, delay ) {
				if (testInterval) callback();
			};
			/* jshint +W020 */
		});

		beforeEach( function() {
			pollCalledTimes = 0;
		});

		it( 'Poll called immediately at start', function() {
			testInterval = false;
			detikDataSource.start();
			test.value( pollCalledTimes ).is( 1 );
		});

		it( 'Poll scheduled for future calls via interval', function() {
			testInterval = true;
			detikDataSource.start();
			test.value( pollCalledTimes ).is( 2 );
		});

		// Restore/erase mocked functions
		after( function(){
			detikDataSource._poll = oldPoll;
			/* jshint -W020 */ // We want to mock out a global function here
			setInterval = oldSetInterval;
			/* jshint +W020 */
		});

	});

	describe( "_fetchResults", function() {
		var oldHttps;
		var oldFilterResults;
		var oldUpdateLastContributionIdFromBatch;

		var dataCallback;
		var endCallback;
		var errorCallback;

		var httpsData;

		var filterResultsCalled;
		var filterResultsReturnTrueOnce;
		var generateRequestError;
		var updateLastContributionIdFromBatchCalled;

		before( function() {
			oldHttps = detikDataSource.https;
			detikDataSource.https = {
				request: function(url, callback){
					var res = {
						setEncoding: function(){},
						on: function(event, callback) {
							if (event==='data') dataCallback = callback;
							if (event==='end') endCallback = callback;
						}
					};
					callback(res);

					var req = {
						on: function(event, callback) {
							if (event==='error') errorCallback = callback;
						},
						end: function() {
							if (generateRequestError) {
								errorCallback({message:'foo',stack:'bar'});
							} else {
								dataCallback(httpsData);
								endCallback();
							}
						}
					};
					return req;
				}
			};

			oldFilterResults = detikDataSource._filterResults;
			detikDataSource._filterResults = function(){
				filterResultsCalled++;
				if (filterResultsReturnTrueOnce) {
					filterResultsReturnTrueOnce = false;
					return true;
				} else {
					return false;
				}
			};

			oldUpdateLastContributionIdFromBatch = detikDataSource._updateLastContributionIdFromBatch;
			detikDataSource._updateLastContributionIdFromBatch = function(){
				updateLastContributionIdFromBatchCalled = true;
			};
		});

		beforeEach( function() {
			filterResultsCalled = 0;
			filterResultsReturnTrueOnce = false;
			generateRequestError = false;
			updateLastContributionIdFromBatchCalled = false;
		});

		it( 'No results returned stops processing', function() {
			httpsData = '{"result":[]}';
			detikDataSource._fetchResults();
			test.value( filterResultsCalled ).is( 0 );
			test.value( updateLastContributionIdFromBatchCalled ).is( true );
		});

		it( 'Invalid result object returned stops processing', function() {
			httpsData = '{invalid-json}';
			detikDataSource._fetchResults();
			test.value( filterResultsCalled ).is( 0 );
			test.value( updateLastContributionIdFromBatchCalled ).is( true );
		});

		it( 'Valid result calls _filterResults', function() {
			httpsData = '{"result":[{}]}';
			detikDataSource._fetchResults();
			test.value( filterResultsCalled ).is( 1 );
			test.value( updateLastContributionIdFromBatchCalled ).is( false );
		});

		it( 'Request error stops processing', function() {
			httpsData = '{"result":[{}]}';
			generateRequestError = true;
			detikDataSource._fetchResults();
			test.value( filterResultsCalled ).is( 0 );
			test.value( updateLastContributionIdFromBatchCalled ).is( true );

		});

		it( 'Multiple pages recurses', function() {
			httpsData = '{"result":[{}]}';
			filterResultsReturnTrueOnce = true;
			detikDataSource._fetchResults();
			test.value( filterResultsCalled ).is( 2 );
			test.value( updateLastContributionIdFromBatchCalled ).is( false );
		});

		// Restore/erase mocked functions
		after( function(){
			detikDataSource.https = oldHttps;
			detikDataSource._filterResults = oldFilterResults;
			detikDataSource._updateLastContributionIdFromBatch = oldUpdateLastContributionIdFromBatch;
		});

	});

	describe( "_filterResults", function() {
		var processedResults = [];

		function generateResult( contributionId, date ) {
			return {
				contributionId: contributionId,
				date: {
					update: {
						sec: date / 1000
					}
				}
			};
		}

		before( function() {
			detikDataSource._processResult = function(result){
				processedResults.push(result);
			};
		});

		beforeEach( function() {
			processedResults = [];
			detikDataSource.config.detik.historicalLoadPeriod = new Date().getTime() + 60000;
			detikDataSource._lastContributionId = 0;
		});

		it( 'New result is processed', function() {
			var results = [];
			test.value( processedResults.length ).is( 0 );
			results.push( generateResult(1,1) );
			detikDataSource._filterResults(results);
			test.value( processedResults.length ).is( 1 );
		});

		it( 'Already processed result is not processed', function() {
			var results = [];
			results.push( generateResult(1,1) );
			detikDataSource._filterResults(results);
			detikDataSource._filterResults(results);
			test.value( processedResults.length ).is( 1 );
		});

		it( 'Result older than cutoff is not processed', function() {
			detikDataSource.config.detik.historicalLoadPeriod = 0;
			var results = [];
			results.push( generateResult(1,1) );
			detikDataSource._filterResults(results);
			test.value( processedResults.length ).is( 0 );
		});

		it( 'Last processed ID is updated from one batch', function() {
			detikDataSource.config.detik.historicalLoadPeriod = 60000;
			var results = [];
			results.push( generateResult(1,new Date().getTime()) );
			results.push( generateResult(2,new Date().getTime()-120000) );
			test.value( detikDataSource._lastContributionId ).is( 0 );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 1 );
		});

		it( 'Last processed ID is not updated from one batch with no filtered result', function() {
			detikDataSource.config.detik.historicalLoadPeriod = 60000;
			var results = [];
			results.push( generateResult(1,new Date().getTime()) );
			results.push( generateResult(2,new Date().getTime()) );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 0 );
		});

		it( 'Last processed ID is updated during last batch of two', function() {
			detikDataSource.config.detik.historicalLoadPeriod = 60000;
			var results = [];
			results.push( generateResult(1,new Date().getTime()) );
			results.push( generateResult(2,new Date().getTime()) );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 0 );
			results = [];
			results.push( generateResult(3,new Date().getTime()) );
			results.push( generateResult(4,new Date().getTime()-120000) );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 3 );
		});

		it( 'Last processed ID is not updated during last batch of two with no filtered result', function() {
			detikDataSource.config.detik.historicalLoadPeriod = 60000;
			var results = [];
			results.push( generateResult(1,new Date().getTime()) );
			results.push( generateResult(2,new Date().getTime()) );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 0 );
			results = [];
			results.push( generateResult(3,new Date().getTime()) );
			results.push( generateResult(4,new Date().getTime()) );
			detikDataSource._filterResults(results);
			test.value( detikDataSource._lastContributionId ).is( 0 );
		});

		// Restore/erase mocked functions
		after( function(){
			detikDataSource.config.detik = {};
		});

	});

// Test template
//	describe( "suite", function() {
//		before( function() {
//		});
//
//		beforeEach( function() {
//		});
//
//		it( 'case', function() {
//		});
//
//		after( function(){
//		});
//	});

});
