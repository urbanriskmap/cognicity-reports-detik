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
			detikDataSource._process('result');
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Enabling caching mode stops realtime filtering and retains tweets', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._process('result');
			test.value( detikDataSource._cachedData.length ).is( 1 );
		});
		
		it( 'Disabling caching mode reenables realtime filtering', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource.disableCacheMode(); // Stop cache mode
			detikDataSource._process('result');
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Cached tweets are processed when caching mode is disabled', function() {
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._process('result');
			test.value( detikDataSource._cachedData.length ).is( 1 );
			detikDataSource.disableCacheMode(); // Stop cache mode
			test.value( detikDataSource._cachedData.length ).is( 0 );
		});

		it( 'Multiple tweet handling', function() {
			detikDataSource._process('result');
			detikDataSource._process('result');
			test.value( detikDataSource._cachedData.length ).is( 0 );
			detikDataSource.enableCacheMode(); // Start cache mode
			detikDataSource._process('result');
			detikDataSource._process('result');
			detikDataSource._process('result');
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
		
		before( function() {	
			oldPoll = detikDataSource._poll;
			oldSetInterval = setInterval;
			detikDataSource._poll = function() {
				pollCalledTimes++;
			};
			/* jshint -W020 */ // We want to mock out a global function here
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