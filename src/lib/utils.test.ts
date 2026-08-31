import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("deve combinar classes simples", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deve lidar com valores undefined", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
  });

  it("deve lidar com valores null", () => {
    expect(cn("foo", null, "bar")).toBe("foo bar");
  });

  it("deve lidar com condicionais", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("deve mesclar classes tailwind conflitantes", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("deve lidar com string vazia", () => {
    expect(cn("")).toBe("");
  });

  it("deve lidar sem argumentos", () => {
    expect(cn()).toBe("");
  });

  it("deve lidar com objetos condicionais", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  it("deve lidar com arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("deve lidar com classes tailwind de cor conflitantes", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("deve preservar classes não-conflitantes", () => {
    const result = cn("rounded-md", "shadow-lg", "border");
    expect(result).toContain("rounded-md");
    expect(result).toContain("shadow-lg");
    expect(result).toContain("border");
  });

  it("deve lidar com variantes responsivas diferentes", () => {
    const result = cn("md:px-4", "lg:px-8");
    expect(result).toContain("md:px-4");
    expect(result).toContain("lg:px-8");
  });

  it("deve mesclar variantes do mesmo breakpoint", () => {
    const result = cn("md:px-2", "md:px-6");
    expect(result).toContain("md:px-6");
    expect(result).not.toContain("md:px-2");
  });

  it("deve lidar com false como argumento", () => {
    expect(cn(false, "foo")).toBe("foo");
  });

  it("deve lidar com 0 como argumento", () => {
    expect(cn(0, "foo")).toBe("foo");
  });
});
