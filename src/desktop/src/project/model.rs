use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct ProjectSnapshot {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub analyses: Vec<Analysis>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Analysis {
    pub id: String,
    pub kind: String,
    pub state: Value,
    pub datasets: Vec<Dataset>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Dataset {
    pub id: String,
    pub name: String,
    pub state: Value,
    pub points: Vec<Point>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
    pub sx: Option<f64>,
    pub sy: Option<f64>,
}
