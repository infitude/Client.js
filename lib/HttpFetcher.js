/*! @license ©2013 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/** A HttpFetcher downloads documents through HTTP. */

var q = require('q'),
    request; // expensive, load lazily

// Creates a new HttpFetcher
function HttpFetcher(maxParallel) {
  this._queue = [];    // Queue of request execution functions
  this._active = {};   // Hash of active requests
  this._pending = 0;   // The number of currently active requests
  this._requestId = 0; // ID of next request
  this._maxParallel = maxParallel || 10; // Only execute this many requests in parallel
}

HttpFetcher.prototype = {
  // Returns a promise for the HTTP request's result
  get: function (url) {
    var self = this, requestId = this._requestId++, deferred = q.defer();
    if (!request)
      request = require('request');

    // Request execution function
    function execute() {
      // Start the request
      var headers = { 'Accept': 'text/turtle;q=1.0,text/html;q=0.5' },
          activeRequest = request({ url: url, headers: headers, timeout: 5000 }, onResponse);
      // Mark the request as active
      self._active[requestId] = activeRequest;
      self._pending++;
    }

    // Response callback
    function onResponse(error, response, body) {
      // Remove the request from the active list
      delete self._active[requestId];
      self._pending--;

      // Schedule a possible pending call
      var next = self._queue.shift();
      if (next)
        process.nextTick(next);

      // Return result through the deferred
      if (error)
        return deferred.reject(new Error(error));
      if (response.statusCode !== 200)
        return deferred.reject(new Error('Request failed: ' + url));
      var contentType = /^[^;]+/.exec(response.headers['content-type'] || 'text/html')[0];
      deferred.resolve({ url: url, type: contentType, body: body });
    }

    // Execute if possible, queue otherwise
    if (this._pending < this._maxParallel)
      execute();
    else
      this._queue.push(execute);

    return deferred.promise;
  },

  // Cancels all pending requests
  cancelAll: function () {
    for (var id in this._active)
      this._active[id].abort();
    this._active = {};
    this._queue = [];
  }
};

module.exports = HttpFetcher;