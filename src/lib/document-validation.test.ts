import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  onlyDigits,
  isValidCPF,
  isValidCNPJ,
  isValidCEP,
  maskCPF,
  maskCNPJ,
  maskCEP,
} from "./document-validation";

// Documentos válidos conhecidos (dígito verificador correto).
const VALID_CPFS = ["529.982.247-25", "52998224725", "111.444.777-35"];
const VALID_CNPJS = ["11.222.333/0001-81", "11222333000181"];

describe("isValidCPF", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    for (const cpf of VALID_CPFS) expect(isValidCPF(cpf)).toBe(true);
  });
  it("rejeita dígitos repetidos", () => {
    for (const cpf of ["00000000000", "111.111.111-11", "99999999999"]) {
      expect(isValidCPF(cpf)).toBe(false);
    }
  });
  it("rejeita tamanho errado e verificador errado", () => {
    expect(isValidCPF("529.982.247-24")).toBe(false); // último dígito errado
    expect(isValidCPF("5299822472")).toBe(false); // 10 dígitos
    expect(isValidCPF("529982247255")).toBe(false); // 12 dígitos
  });
  it("nulo/vazio → false", () => {
    expect(isValidCPF(null)).toBe(false);
    expect(isValidCPF(undefined)).toBe(false);
    expect(isValidCPF("")).toBe(false);
  });
});

describe("isValidCNPJ", () => {
  it("aceita CNPJs válidos (com e sem máscara)", () => {
    for (const c of VALID_CNPJS) expect(isValidCNPJ(c)).toBe(true);
  });
  it("rejeita dígitos repetidos e verificador errado", () => {
    expect(isValidCNPJ("00000000000000")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false); // último dígito errado
  });
  it("rejeita tamanho errado", () => {
    expect(isValidCNPJ("1122233300018")).toBe(false); // 13 dígitos
    expect(isValidCNPJ("112223330001811")).toBe(false); // 15 dígitos
  });
  it("nulo/vazio → false", () => {
    expect(isValidCNPJ(null)).toBe(false);
    expect(isValidCNPJ("")).toBe(false);
  });
});

describe("isValidCEP", () => {
  it("aceita 8 dígitos (com/sem máscara)", () => {
    expect(isValidCEP("01310-100")).toBe(true);
    expect(isValidCEP("01310100")).toBe(true);
  });
  it("rejeita tamanho errado", () => {
    expect(isValidCEP("0131010")).toBe(false);
    expect(isValidCEP("")).toBe(false);
    expect(isValidCEP(null)).toBe(false);
  });
});

describe("máscaras", () => {
  it("maskCPF/maskCNPJ/maskCEP formatam corretamente", () => {
    expect(maskCPF("52998224725")).toBe("529.982.247-25");
    expect(maskCNPJ("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCEP("01310100")).toBe("01310-100");
  });
});

describe("Property 1: validação é total (nunca lança, sempre boolean)", () => {
  it("isValidCPF/CNPJ/CEP", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(typeof isValidCPF(s)).toBe("boolean");
        expect(typeof isValidCNPJ(s)).toBe("boolean");
        expect(typeof isValidCEP(s)).toBe("boolean");
      }),
    );
  });
});

describe("Property 2: máscara não altera validade", () => {
  it("CPF válido: com máscara === sem máscara", () => {
    for (const cpf of VALID_CPFS) {
      expect(isValidCPF(maskCPF(cpf))).toBe(isValidCPF(cpf));
      expect(isValidCPF(maskCPF(cpf))).toBe(true);
    }
  });
  it("CNPJ válido: com máscara === sem máscara", () => {
    for (const c of VALID_CNPJS) {
      expect(isValidCNPJ(maskCNPJ(c))).toBe(isValidCNPJ(c));
      expect(isValidCNPJ(maskCNPJ(c))).toBe(true);
    }
  });
});

describe("Property 3: dígitos repetidos e tamanho errado sempre inválidos", () => {
  it("CPF", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (dig) => {
        expect(isValidCPF(String(dig).repeat(11))).toBe(false);
      }),
    );
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter((s) => onlyDigits(s).length !== 11),
        (s) => {
          expect(isValidCPF(s)).toBe(false);
        },
      ),
    );
  });
  it("CNPJ", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (dig) => {
        expect(isValidCNPJ(String(dig).repeat(14))).toBe(false);
      }),
    );
  });
});

describe("Property 4: onlyDigits idempotente e só-dígitos", () => {
  it("onlyDigits", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = onlyDigits(s);
        expect(onlyDigits(once)).toBe(once);
        expect(/^\d*$/.test(once)).toBe(true);
      }),
    );
  });
});
