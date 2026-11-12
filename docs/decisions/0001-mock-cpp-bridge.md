# ADR 0001: ponte C para demonstração do motor C++

- Estado: aceita para o protótipo; contrato científico definitivo em avaliação.
- Contexto: validar o caminho React → comando Tauri/Rust → C++ com um resultado fixo e reconhecível, sem alegar cálculo científico.
- Decisão: compilar C++ com `cc` no build Rust e chamar uma função `extern "C"` que retorna uma estrutura de valores fixos, sem ponteiros. Rust converte o retorno em JSON para o frontend. Um teste Rust atravessa a fronteira nativa.
- Alternativas: processo separado ou biblioteca compartilhada. Adiam-se para avaliação das necessidades de isolamento, cancelamento, manutenção e distribuição.
- Consequências: exige compilador C++ na máquina de build; falhas nativas compartilham o processo desktop. A estrutura é temporária e não define o contrato científico, formato de projeto, tratamento de erros ou paridade numérica. Antes de calcular de verdade, avaliar alternativas e estabelecer contrato versionado, fixtures e tolerâncias.
