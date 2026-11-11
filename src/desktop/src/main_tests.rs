use super::*;

#[test]
fn mock_crosses_cpp_boundary() {
    let result = get_mock_analysis();
    assert_eq!(result.slope, 1.2);
    assert_eq!(result.intercept, 0.5);
    assert_eq!(result.r_squared, 0.994);
    assert_eq!(result.x, [0.0, 1.0, 2.0, 3.0, 4.0]);
    assert_eq!(result.y, [0.5, 1.8, 2.8, 4.2, 5.3]);
}
