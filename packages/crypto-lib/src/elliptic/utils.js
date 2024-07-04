import BN from "bn.js";
import minAssert from "minimalistic-assert";
import minUtils from "minimalistic-crypto-utils";

// Represent num in a w-NAF form
function getNAF(num, w, bits) {
  var naf = new Array(Math.max(num.bitLength(), bits) + 1);
  naf.fill(0);

  var ws = 1 << (w + 1);
  var k = num.clone();

  for (var i = 0; i < naf.length; i++) {
    var z;
    var mod = k.andln(ws - 1);
    if (k.isOdd()) {
      if (mod > (ws >> 1) - 1) z = (ws >> 1) - mod;
      else z = mod;
      k.isubn(z);
    } else {
      z = 0;
    }

    naf[i] = z;
    k.iushrn(1);
  }

  return naf;
}

// Represent k1, k2 in a Joint Sparse Form
function getJSF(k1, k2) {
  var jsf = [[], []];

  k1 = k1.clone();
  k2 = k2.clone();
  var d1 = 0;
  var d2 = 0;
  var m8;
  while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {
    // First phase
    var m14 = (k1.andln(3) + d1) & 3;
    var m24 = (k2.andln(3) + d2) & 3;
    if (m14 === 3) m14 = -1;
    if (m24 === 3) m24 = -1;
    var u1;
    if ((m14 & 1) === 0) {
      u1 = 0;
    } else {
      m8 = (k1.andln(7) + d1) & 7;
      if ((m8 === 3 || m8 === 5) && m24 === 2) u1 = -m14;
      else u1 = m14;
    }
    jsf[0].push(u1);

    var u2;
    if ((m24 & 1) === 0) {
      u2 = 0;
    } else {
      m8 = (k2.andln(7) + d2) & 7;
      if ((m8 === 3 || m8 === 5) && m14 === 2) u2 = -m24;
      else u2 = m24;
    }
    jsf[1].push(u2);

    // Second phase
    if (2 * d1 === u1 + 1) d1 = 1 - d1;
    if (2 * d2 === u2 + 1) d2 = 1 - d2;
    k1.iushrn(1);
    k2.iushrn(1);
  }

  return jsf;
}

function cachedProperty(obj, name, computer) {
  var key = "_" + name;
  obj.prototype[name] = function cachedProperty() {
    return this[key] !== undefined ? this[key] : (this[key] = computer.call(this));
  };
}

function parseBytes(bytes) {
  return typeof bytes === "string" ? utils.toArray(bytes, "hex") : bytes;
}

function intFromLE(bytes) {
  return new BN(bytes, "hex", "le");
}

export default {
  assert: minAssert,
  toArray: minUtils.toArray,
  zero2: minUtils.zero2,
  toHex: minUtils.toHex,
  encode: minUtils.encode,
  getNAF,
  getJSF,
  cachedProperty,
  parseBytes,
  intFromLE,
};