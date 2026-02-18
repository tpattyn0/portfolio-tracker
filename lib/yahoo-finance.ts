import YahooFinance from "yahoo-finance2";

// Single shared instance of yahoo-finance2 v3
// v3 requires instantiation with `new` (unlike v2 which used a default export)
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export default yahooFinance;
