# JMeter Load Testing Guide

This folder contains the Apache JMeter test plan and performance testing results for the WHOLA × HubSpot middleware integration.

The purpose of this test is to validate whether the middleware can reliably process customer behaviour events under sustained load and return stable response times without failures.

---

## 1. Files in This Folder

| File                              | Description                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `product_view.jmx`                | JMeter test plan for middleware load injection across all event types |
| `Jmeter_results_30minsExecut.zip` | HTML dashboard report generated after the 30-minute JMeter execution  |
| `Splunk_Query_Metrics.txt`        | Splunk query used to monitor middleware processing metrics            |

---

## 2. How to Open JMeter on Windows

Open **Windows PowerShell as Administrator**.

Navigate to the Apache JMeter `bin` folder. Example:

```powershell
cd C:\Users\Administrator\Desktop\apache-jmeter-5.6.3\bin
```

Start JMeter using:

```powershell
.\jmeter.bat
```

After JMeter opens:

1. Click **File > Open**
2. Select the test plan file:

   ```text
   product_view.jmx
   ```
3. The test plan will show the middleware service flows used for load testing.

---

## 3. JMeter Test Plan Structure

The test plan covers six middleware event services:

* `Login_payload`
* `Product_View`
* `Cart_events`
* `Page_View`
* `Cart_events_Removal`
* `Logout_payload`

These services represent the main customer behaviour events processed by the middleware and sent to HubSpot.

---

## 4. Performance and Stress Testing Overview

To validate the middleware’s reliability and response times under realistic load, a stress test was conducted using **Apache JMeter**, with runtime monitoring supported by **Splunk**.

The test simulated concurrent customer activity across all six event types for a sustained 30-minute period.

---

## 5. Test Setup

| Parameter               | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| Tool                    | Apache JMeter                                            |
| Test Type               | Stress / Load Test — sustained concurrent load           |
| Thread Group            | Single thread group covering all services simultaneously |
| Test Duration           | 30 minutes                                               |
| Total Requests Injected | 9,697                                                    |
| Combined Throughput     | 420 requests per minute                                  |
| Failures                | 0                                                        |
| Overall Error Rate      | 0.00%                                                    |

Each minute, the middleware processed a combined **420 requests** across all services simultaneously. This simulates concurrent customer activity across every event type handled by the system.

---

## 6. Throughput Configuration per Service

**TPM** means **Transactions Per Minute**.
It represents the number of request messages injected into the middleware per minute for each service.

| Service               |     TPM | Description                                                        |
| --------------------- | ------: | ------------------------------------------------------------------ |
| `Page_View`           |     200 | Highest frequency; simulates customers continuously browsing pages |
| `Product_View`        |     100 | Product page views per minute                                      |
| `Cart_events`         |      50 | Cart add events per minute                                         |
| `Login_payload`       |      30 | Customer login events per minute                                   |
| `Logout_payload`      |      30 | Customer logout events per minute                                  |
| `Cart_events_Removal` |      10 | Cart remove events per minute                                      |
| **Total**             | **420** | Combined requests processed by the middleware every minute         |

The total of all service TPM values is **420**, meaning the middleware processed approximately **420 request messages per minute** across all services.

Over the 30-minute test period, this produced **9,697 total injected requests**.

---

## 7. JMeter Result Summary

| Service          |   Samples | Failures |   Error % | Average Response Time |
| ---------------- | --------: | -------: | --------: | --------------------: |
| **Total**        | **9,697** |    **0** | **0.00%** |       **1,113.64 ms** |
| `Cart_events`    |     4,547 |        0 |     0.00% |             791.53 ms |
| `Login_payload`  |     1,399 |        0 |     0.00% |           1,286.14 ms |
| `Logout_payload` |     1,405 |        0 |     0.00% |           1,280.95 ms |
| `Page_View`      |     1,401 |        0 |     0.00% |           1,284.49 ms |
| `Product_View`   |       945 |        0 |     0.00% |           1,906.09 ms |

---

## 8. How to View the JMeter HTML Report

1. Extract:

   ```text
   Jmeter_results_30minsExecut.zip
   ```

2. Open the extracted folder.

3. Open:

   ```text
   index.html
   ```

4. In the left sidebar of the JMeter dashboard, check:

   * **Response Times Over Time**
   * **Active Threads Over Time**
   * **Throughput**
   * **Response Time Percentiles Over Time**

---

## 9. How to Interpret the Report

### Response Times Over Time

This chart shows how middleware response time changed during the 30-minute test.

* X-axis: time interval
* Y-axis: response time in milliseconds
* Each line represents one service, such as `Cart_events`, `Login_payload`, `Page_View`, or `Product_View`

The highest response time was around **2,500 ms**, which is approximately **2.5 seconds**.

The `Product_View` service had the highest average response time because it triggers a heavier workflow, including contact lookup, timeline note creation, brand_view object creation, and HubSpot association calls.

### Active Threads Over Time

This chart shows how many active threads were running during the test.

It helps verify that the middleware does not show abnormal thread growth or connection leakage during sustained load.

---

## 10. Analysis

The middleware successfully handled the 30-minute stress test across all six event services.

Key findings:

* **Zero failures across 9,697 requests**
  The middleware handled sustained load without errors or timeouts.

* **Cart_events had the fastest average response time: 791.53 ms**
  This is expected because cart update events follow a simpler HubSpot call path.

* **Product_View had the highest average response time: 1,906.09 ms**
  This is expected because product view processing involves a more complex workflow, including contact lookup, timeline note creation, brand_view object creation, and association logic.

* **Overall average response time was 1,113.64 ms**
  This is well within the 10-second Axios timeout configured in the middleware.

* **Overall error rate was 0.00%**
  This confirms that the middleware remained stable under the tested load.

---

## 11. Conclusion

The JMeter stress test confirms that the middleware can process concurrent customer behaviour events across login, logout, product view, page view, cart add, and cart removal services.

The system handled **9,697 requests** over a 30-minute period with **0 failures** and **0.00% error rate**.

This validates that the middleware is stable under realistic load and suitable for supporting the WHOLA × HubSpot behavioural tracking integration.
