/** @file mock_analysis.cpp Fixed demonstration data for the C ABI. */
#include "mock_analysis.h"

extern "C" AtusMockAnalysis atus_mock_analysis(void) {
    return {1.2, 0.5, 0.994, {0.0, 1.0, 2.0, 3.0, 4.0},
            {0.5, 1.8, 2.8, 4.2, 5.3}};
}
