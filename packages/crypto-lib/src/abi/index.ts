import ABI from "./abi";

function RawEncode(types: string[], values: any[]): Buffer {
  return ABI.rawEncode(types, values);
}

function SoliditySHA3(types: string[], values: any[]): Buffer {
  return ABI.soliditySHA3(types, values);
}

export { ABI, RawEncode, SoliditySHA3 };
