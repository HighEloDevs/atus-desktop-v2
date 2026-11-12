/** @file mock_analysis.h Fixed demonstration data exposed through the C ABI. */
#ifndef ATUS_MOCK_ANALYSIS_H
#define ATUS_MOCK_ANALYSIS_H

#ifdef __cplusplus
extern "C" {
#endif

/** Fixed demonstration coefficients, metric, and five x/y points. */
typedef struct {
    double slope;
    double intercept;
    double r_squared;
    double x[5];
    double y[5];
} AtusMockAnalysis;

/** Returns owned fixed example data and illustrative statistics. Does not perform a fit. */
AtusMockAnalysis atus_mock_analysis(void);

#ifdef __cplusplus
}
#endif
#endif
