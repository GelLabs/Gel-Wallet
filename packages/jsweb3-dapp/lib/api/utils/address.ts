import { utils } from "ethers";

interface IIGetCorrectAddress {
  address: string;
}
export function getCorrectAddress(args: IIGetCorrectAddress) {
  const { address } = args;
  let result = address;
  try {
    if (utils.isHexString(address)) {
      result = utils.getAddress(address);
    }
  } catch (err) {
    console.error("getCorrectAddressError", err);
  }
  return result;
}
