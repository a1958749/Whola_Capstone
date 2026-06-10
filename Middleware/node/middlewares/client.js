"use strict";

/*
  Minimal HTTP client wrapper used by BrandViewService and HubspotService.
  This file exists so modules can call getHttp() and receive an axios instance
  preconfigured with HubSpot auth headers from util/constants.js.
*/

const axios = require("axios");
const path = require("path");
const constants = require(path.join(__dirname, "..", "util", "constants.js"));

function getHttp() {
  return axios.create({
    headers: {
      Authorization: `Bearer ${constants.HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: Number(process.env.HUBSPOT_HTTP_TIMEOUT_MS || 10000),
  });
}

module.exports = { getHttp };
