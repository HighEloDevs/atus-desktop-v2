#ifndef ATUS_MOCK_ANALYSIS_H
#define ATUS_MOCK_ANALYSIS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    double slope;
    double intercept;
    double r_squared;
    double x[5];
    double y[5];
} AtusMockAnalysis;

/* Demonstration data only; does not perform a fit. */
AtusMockAnalysis atus_mock_analysis(void);

#ifdef __cplusplus
}
#endif
#endif
