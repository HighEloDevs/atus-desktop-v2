/** @file mock_analysis_test.c Exercises the demonstration data through its public C ABI. */
#include "mock_analysis.h"
#include <assert.h>
#include <stddef.h>

int main(void) {
    const double expected_x[5] = {0.0, 1.0, 2.0, 3.0, 4.0};
    const double expected_y[5] = {0.5, 1.8, 2.8, 4.2, 5.3};
    AtusMockAnalysis first = atus_mock_analysis();
    assert(first.slope == 1.2);
    assert(first.intercept == 0.5);
    assert(first.r_squared == 0.994);
    for (size_t index = 0; index < 5; ++index) {
        assert(first.x[index] == expected_x[index]);
        assert(first.y[index] == expected_y[index]);
    }
    first.x[0] = -100.0;
    first.y[0] = -100.0;
    AtusMockAnalysis second = atus_mock_analysis();
    assert(second.x[0] == expected_x[0]);
    assert(second.y[0] == expected_y[0]);
    return 0;
}
