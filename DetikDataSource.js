'use strict';

/**
 * The Detik data source.
 * Poll the specified Detik feed for new data and send it to the reports application.
 * @constructor
 * @param {Reports} reports An instance of the reports object.
 * @param {object} config Gnip powertrack specific configuration.
 */
var DetikDataSource = function DetikDataSource(
		reports,
		config
	){
	
	// Store references to reports and logger
	this.reports = reports;
	this.logger = reports.logger;

	// Copy reports config into our own config
	this.config = reports.config;
	for (var prop in config) {
		if (config.hasOwnProperty(prop)) {
			this.config[prop] = config[prop];
		}
	}
	
	this.https = require('https');
	
	// Set constructor reference (used to print the name of this data source)
	this.constructor = DetikDataSource;
};

DetikDataSource.prototype = {
		
	/**
	 * Data source configuration.
	 * This contains the reports configuration and the data source specific configuration.
	 * @type {object}
	 */
	config: {},
	
	/**
	 * Instance of the reports module that the data source uses to interact with Cognicity Server.
	 * @type {Reports}
	 */
	reports: null,
	
	/**
	 * Instance of the Winston logger.
	 */
	logger: null,

	/**
	 * Instance of node https.
	 */
	https: null,

	/**
	 * Flag signifying if we are currently able to process incoming data immediately.
	 * Turned on if the database is temporarily offline so we can cache for a short time.
	 * @type {boolean}
	 */
	_cacheMode: false,
	
	/**
	 * Store data if we cannot process immediately, for later processing.
	 * @type {Array}
	 */
	_cachedData: [],
	
	/**
	 * Last contribution ID from Detik result that was processed.
	 * Used to ensure we don't process the same result twice.
	 * @type {number}
	 */
	_lastContributionId: 0,
	
	/**
	 * Highest contribution ID from current batch of Detik results.
	 * @type {number}
	 */
	_highestBatchContributionId: 0,
	
	/**
	 * Reference to the polling interval.
	 * @type {number} 
	 */
	_interval: null,
	
	/**
	 * Polling worker function.
	 * Poll the Detik web service and process the results.
	 * This method is called repeatedly on a timer.
	 */
	_poll: function(){
		var self = this;
				
		// Keep track of the newest contribution ID we get in this poll.
		// We want to update our 'latest contribution ID' after we finish this whole batch.
		self._highestBatchContributionId = self._lastContributionId;
		
		// Begin processing results from page 1 of data
		self._fetchResults();
	},
	
	/**
	 * Fetch one page of results
	 * Call the callback function on the results
	 * Recurse and call self to fetch the next page of results if required
	 * @param {number} page Page number of results to fetch, defaults to 1
	 */ 
	_fetchResults: function( page ) {
		var self = this;
		
		if (!page) page = 1;
		
		self.logger.verbose( 'DetikDataSource > poll > fetchResults: Loading page ' + page );
		
		var requestURL = self.config.detik.serviceURL + "&page=" + page;
		var response = "";
		
		var req = self.https.request( requestURL , function(res) {
		  res.setEncoding('utf8');
		  
		  res.on('data', function (chunk) {
		    response += chunk;
		  });
		  
		  res.on('end', function() {
		    var responseObject;
		    try {
		    	responseObject = JSON.parse( response );
		    } catch (e) {
		    	self.logger.error( "DetikDataSource > poll > fetchResults: Error parsing JSON: " + response );
		    	return;
		    }
		    
		    self.logger.debug('DetikDataSource > poll > fetchResults: Page ' + page + " fetched, " + response.length + " bytes");
		    
			if ( !responseObject || !responseObject.result || responseObject.result.length === 0 ) {
				// If page has a problem or 0 objects, end
				self.logger.error( "DetikDataSource > poll > fetchResults: No results found on page " + page );
				return;
			} else {
				// Run data processing callback on the result objects
				if ( self._filterResults( responseObject.result ) ) {
					// If callback returned true, processing should continue on next page
					page++;
					self._fetchResults( page );
				}
			}
		  });
		});
		
		req.on('error', function(error) {
			self.logger.error( "DetikDataSource > poll > fetchResults: Error fetching page " + page + ", " + error.message + ", " + error.stack );
		});
		
		req.end();
	},
	
	/**
	 * Process the passed result objects
	 * Stop processing if we've seen a result before, or if the result is too old
	 * @param {Array} results Array of result objects from the Detik data to process
	 * @return {boolean} True if we should continue to process more pages of results
	 */ 
	_filterResults: function( results ) {
		var self = this;
		
		var continueProcessing = true;
		
		// For each result:
		var result = results.shift();
		while( result ) {
			if ( result.contributionId <= self._lastContributionId ) {
				// We've seen this result before, stop processing
				self.logger.debug( "DetikDataSource > poll > processResults: Found already processed result with contribution ID " + result.contributionId );
				continueProcessing = false;
				break;
			} else if ( result.date.update.sec * 1000 < new Date().getTime() - self.config.detik.historicalLoadPeriod ) {
				// This result is older than our cutoff, stop processing
				// TODO What date to use? transform to readable. timezone
				self.logger.debug( "DetikDataSource > poll > processResults: Result " + result.contributionId + " older than maximum configured age of " + self.config.detik.historicalLoadPeriod / 1000 + " seconds" );
				continueProcessing = false;
				break;
			} else {
				// Process this result
				self.logger.verbose( "DetikDataSource > poll > processResults: Processing result " + result.contributionId );
				// Retain the contribution ID
				if ( self._highestBatchContributionId < result.contributionId ) {
					self._highestBatchContributionId = result.contributionId;
				}
				self._processResult( result );
			}
			result = results.shift();
		}
		
		// If we've reached the end of this polling run, update the stored contribution ID
		if ( !continueProcessing ) {
			if ( self._lastContributionId < self._highestBatchContributionId ) {
				self._lastContributionId = self._highestBatchContributionId;
			}
		}
		
		return continueProcessing;
	},
	
	/**
	 * Process a result.
	 * This method is called for each new result we fetch from the web service.
	 * @param {object} result The result object from the web service
	 */
	_processResult: function( result ) {
		var self = this;
		
		if ( self._cacheMode ) {
			// Store result for later processing
			self._cachedData.push( result );
		} else {
			// Process result now
			self._saveResult();
		}
	},

	/**
	 * Save a result to cognicity server.
	 * @param {object} result The result object from the web service
	 */
	_saveResult: function( result ) {
		// var self = this;
		// TODO Send result to cognicity server
	},
	
	/**
	 * Connect the Gnip stream.
	 * Establish the network connection, push rules to Gnip.
	 * Setup error handlers and timeout handler.
	 * Handle events from the stream on incoming data.
	 */
	start: function(){
		var self = this;
		
		// Called on interval to poll data source
		var poll = function(){
			self.logger.debug( "DetikDataSource > start: Polling " + self.config.detik.serviceURL + " every " + self.config.detik.pollInterval / 1000 + " seconds" );
			self._poll();
		};
		
		// Poll now, immediately
		poll();
		// Setup interval to poll repeatedly in future
		self._interval = setInterval( 
			poll,
			self.config.detik.pollInterval
		);
	},
	
	/**
	 * Stop realtime processing of results and start caching results until caching mode is disabled.
	 */
	enableCacheMode: function() {
		var self = this;
		
		self.logger.verbose( 'DetikDataSource > enableCacheMode: Enabling caching mode' );
		self._cacheMode = true;
	},

	/**
	 * Resume realtime processing of results.
	 * Also immediately process any results cached while caching mode was enabled.
	 */
	disableCacheMode: function() {
		var self = this;
		
		self.logger.verbose( 'DetikDataSource > disableCacheMode: Disabling caching mode' );
		self._cacheMode = false;
		
		self.logger.verbose( 'DetikDataSource > disableCacheMode: Processing ' + self._cachedData.length + ' cached results' );
		self._cachedData.forEach( function(data) {
			self._processResult(data);
		});
		self.logger.verbose( 'DetikDataSource > disableCacheMode: Cached results processed' );
		self._cachedData = [];
	}

};

// Export the PowertrackDataSource constructor
module.exports = DetikDataSource;