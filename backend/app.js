const express = require("express");
const app = express();
const port = 3000;

const axios = require("axios")
const moment = require("moment");
const calculateCorrelation = require("calculate-correlation");

function validateDates(dateString1, dateString2) {
    return moment(dateString1, "YYYY-MM-DD", true).isValid() 
    && moment(dateString2, "YYYY-MM-DD", true).isValid() 
    && moment(dateString1).isBefore(moment(dateString2));
}

const baseURL = "https://www.bankofcanada.ca/valet/";

async function makeValetRequest(startDate, endDate, seriesName) {
    const requestURL = baseURL + `observations/${seriesName}?start_date=${startDate}&end_date=${endDate}`;
    let res = await axios.get(requestURL);
    return [res.status, res.data.observations.map(x => parseFloat(x[seriesName].v))];
}

function calculateStatistics(dataPoints) {
    min = dataPoints[0];
    max = dataPoints[0];
    sum = dataPoints[0];
    for (let i = 1; i < dataPoints.length; i++) {
        min = Math.min(min, dataPoints[i]);
        max = Math.max(max, dataPoints[i]);
        sum += dataPoints[i];
    }
    mean = sum / dataPoints.length;
    return [min, max, mean];
}

app.use("/", express.static("../frontend"));

app.get("/data", (req, res) => {
    console.log(`received request from ${req.hostname}`)
    startDate = req.query.startDate;
    endDate = req.query.endDate;
    if (validateDates(startDate, endDate)) {
            let promises = []
            promises.push(makeValetRequest(req.query.startDate, req.query.endDate, "FXUSDCAD"));
            promises.push(makeValetRequest(req.query.startDate, req.query.endDate, "AVG.INTWO"));
    
            Promise.all(promises).then(([fxData, corraData]) => {
                let [fxMin, fxMax, fxMean] = calculateStatistics(fxData[1]);
                let [corraMin, corraMax, corraMean] = calculateStatistics(corraData[1]);
                res.json({
                    "status": 200,
                    "text": "Success",
                    "body": {
                        "fxData": {
                            "min": fxMin,
                            "max": fxMax,
                            "mean": fxMean,
                        },
                        "corraData": {
                            "min": corraMin,
                            "max": corraMax,
                            "mean": corraMean,
                        },
                        "coefficientData": calculateCorrelation(fxData[1], corraData[1]),
                    }
                })
            })
    } else {
        res.json({"status": 400, "text": "Invalid input, please double check the dates, start date should come before end date, dates should be valid and in the format YYYY-MM-DD"});
    }
})

app.listen(port, () => {
    console.log(`Correlation app listening on port ${port}`);
})

