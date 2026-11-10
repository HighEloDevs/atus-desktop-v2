fn main() {
    println!("cargo:rerun-if-changed=../scientific-engine/src/mock_analysis.cpp");
    println!("cargo:rerun-if-changed=../scientific-engine/include/mock_analysis.h");
    cc::Build::new()
        .cpp(true)
        .file("../scientific-engine/src/mock_analysis.cpp")
        .include("../scientific-engine/include")
        .compile("atus_scientific_engine");
    tauri_build::build();
}
