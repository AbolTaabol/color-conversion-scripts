<script>

function lerp(a, b, t) {
    if (Array.isArray(a)) {
        var result = [];
        for (let i = 0; i < a.length; i++) {
            result.push(lerp(a[i], b[i], t));
        }
        return result;
    } else {
        return a + (b - a) * t;
    }
}
function mat_vec_mul(m, v) {
    var result = [];
    for (row of m) {
        let sum = 0;
        for (let i = 0; i < row.length; i++) {
            sum += row[i] * v[i];
        }
        result.push(sum);
    }
    return result;
}
// Argument is in range 0..1
function srgb_eotf(u) {
    if (u < 0.04045) {
        return u / 12.92;
    } else {
        return Math.pow((u + 0.055) / 1.055, 2.4);
    }
}
function srgb_eotf_inv(u) {
    if (u < 0.0031308) {
        return u * 12.92;
    } else {
        return 1.055 * Math.pow(u, 1/2.4) - 0.055;
    }
}
// Source: Wikipedia sRGB article, rounded to 4 decimals
const SRGB_TO_XYZ = [
    [0.4124, 0.3576, 0.1805],
    [0.2126, 0.7152, 0.0722],
    [0.0193, 0.1192, 0.9505]
];
const XYZ_TO_SRGB = [
    [3.2410, -1.5374, -0.4986],
    [-0.9692, 1.8760, 0.0416],
    [0.0556, -0.2040, 1.0570]
];
// Color is sRGB with 0..255 range. Result is in D65 white point.
function sRGB_to_XYZ(rgb) {
    const rgblin = rgb.map(x => srgb_eotf(x / 255));
    return mat_vec_mul(SRGB_TO_XYZ, rgblin);
}
function XYZ_to_sRGB(xyz) {
    const rgblin = mat_vec_mul(XYZ_TO_SRGB, xyz);
    return rgblin.map(x => Math.round(255 * srgb_eotf_inv(x)));
}
const SRGB = {"to_xyz": sRGB_to_XYZ, "from_xyz": XYZ_to_sRGB};


// From Oklab article, then some numpy. Note these are transposed. I'm
// not sure I have the conventions right, but it is giving the right
// answer.
const OKLAB_M1 = [
    [ 0.8189,  0.3619, -0.1289],
    [ 0.033 ,  0.9293,  0.0361],
    [ 0.0482,  0.2644,  0.6339]
];
const OKLAB_M2 = [
    [ 0.2105,  0.7936, -0.0041],
    [ 1.978 , -2.4286,  0.4506],
    [ 0.0259,  0.7828, -0.8087]
];
const OKLAB_INV_M1 = [
    [ 1.227 , -0.5578,  0.2813],
    [-0.0406,  1.1123, -0.0717],
    [-0.0764, -0.4215,  1.5862]
];
const OKLAB_INV_M2 = [
    [ 1.0   ,  0.3963,  0.2158],
    [ 1.0   , -0.1056, -0.0639],
    [ 1.0   , -0.0895, -1.2915]
];
function Oklab_to_XYZ(lab) {
    const lms = mat_vec_mul(OKLAB_INV_M2, lab);
    const lmslin = lms.map(x => x * x * x);
    return mat_vec_mul(OKLAB_INV_M1, lmslin);
}
function XYZ_to_Oklab(xyz) {
    const lmslin = mat_vec_mul(OKLAB_M1, xyz);
    const lms = lmslin.map(Math.cbrt);
    return mat_vec_mul(OKLAB_M2, lms);
}
const OKLAB = {"to_xyz": Oklab_to_XYZ, "from_xyz": XYZ_to_Oklab};

function cielab_f(t) {
    const d = 6.0/29.0;
    if (t < d * d * d) {
        return t / (3 * d * d) + 4.0/29.0;
    } else {
        return Math.cbrt(t);
    }
}
function cielab_f_inv(t) {
    const d = 6.0/29.0;
    if (t < d) {
        return 3 * d * d * (t - 4.0/29.0);
    } else {
        return t * t * t;
    }
}
function XYZ_to_Lab(xyz) {
    // Just normalizing XYZ values to the white point is the "wrong von Kries"
    // transformation, which is faithful to the spec.
    const xyz_n = [xyz[0] / .9505, xyz[1], xyz[2] / 1.0888];
    const fxyz = xyz_n.map(cielab_f);
    const L = 116 * fxyz[1] - 16;
    const a = 500 * (fxyz[0] - fxyz[1]);
    const b = 200 * (fxyz[1] - fxyz[2]);
    return [L, a, b];
}
function Lab_to_XYZ(lab) {
    const l_ = (lab[0] + 16) / 116;
    const x = 0.9505 * cielab_f_inv(l_ + lab[1] / 500);
    const y = cielab_f_inv(l_);
    const z = 1.0888 * cielab_f_inv(l_ - lab[2] / 200);
    return [x, y, z];
}
const CIELAB = {"to_xyz": Lab_to_XYZ, "from_xyz": XYZ_to_Lab};

// https://professional.dolby.com/siteassets/pdfs/ictcp_dolbywhitepaper_v071.pdf
const ICTCP_XYZ_TO_LMS = [
    [ 0.3593,  0.6976, -0.0359],
    [-0.1921,  1.1005,  0.0754],
    [ 0.0071,  0.0748,  0.8433]
];
const ICTCP_LMS_TO_ITP = [
    [ 0.5   ,  0.5   ,  0.0   ],
    [ 1.6138, -3.3235,  1.7097],
    [ 4.3782, -4.2456, -0.1326]
];
const ICTCP_LMS_TO_XYZ = [
    [ 2.0703, -1.3265,  0.2067],
    [ 0.3647,  0.6806, -0.0453],
    [-0.0498, -0.0492,  1.1881]
];
const ICTCP_ITP_TO_LMS = [
    [ 1.0   ,  0.0086,  0.111 ],
    [ 1.0   , -0.0086, -0.111 ],
    [ 1.0   ,  0.56  , -0.3206]
];
const m1 = 2610/16384;
const m2 = 2523/4096 * 128;
const c2 = 2413/4096 * 32;
const c3 = 2392/4096 * 32;
const c1 = c3 - c2 + 1;
// This peak luminance value is from the Dolby whitepaper but seems too high.
const L_p = 10000;
// Note: 80 is what is specified by sRGB but seems too low; this value is chosen
// to be typical for actual non-HDR displays.
const L_display = 200;
function st_2084_eotf_inv(n) {
    const fd = n * L_display;
    const y = fd / L_p;
    const ym1 = Math.pow(y, m1);
    return Math.pow((c1 + c2 * ym1) / (1 + c3 * ym1), m2);
}
function st_2084_eotf(x) {
    const V_p = Math.pow(x, 1 / m2);
    const n = V_p - c1;
    // maybe max with 0 here?
    const L = Math.pow(n / (c2 - c3 * V_p), 1 / m1);
    return L * L_p / L_display;
}
function ICtCp_to_XYZ(lab) {
    const lms = mat_vec_mul(ICTCP_ITP_TO_LMS, lab);
    const lmslin = lms.map(st_2084_eotf);
    return mat_vec_mul(ICTCP_LMS_TO_XYZ, lmslin);
}
function XYZ_to_ICtCp(xyz) {
    const lmslin = mat_vec_mul(ICTCP_XYZ_TO_LMS, xyz);
    const lms = lmslin.map(st_2084_eotf_inv);
    return mat_vec_mul(ICTCP_LMS_TO_ITP, lms);
}
const ICTCP = {"to_xyz": ICtCp_to_XYZ, "from_xyz": XYZ_to_ICtCp};

///
const IPT_XYZ_TO_LMS = [
    [0.4002, 0.7075, -0.0807],
    [-0.2280, 1.1500, 0.0612],
    [0.0000, 0.0000, 0.9184]
];
const IPT_LMS_TO_IPT = [
    [0.4000, 0.4000, 0.2000],
    [4.4550, -4.8510, 0.3960],
    [0.8056, 0.3572, -1.1628],
];
const IPT_LMS_TO_XYZ = [
    [ 1.8502, -1.1383,  0.2384],
    [ 0.3668,  0.6439, -0.0107],
    [ 0.0   ,  0.0   ,  1.0889]
];
const IPT_IPT_TO_LMS = [
    [ 1.0   ,  0.0976,  0.2052],
    [ 1.0   , -0.1139,  0.1332],
    [ 1.0   ,  0.0326, -0.6769]
];
function IPT_to_XYZ(lab) {
    const lms = mat_vec_mul(IPT_IPT_TO_LMS, lab);
    const lmslin = lms.map(x => Math.pow(x, 1.0 / 0.43));
    return mat_vec_mul(IPT_LMS_TO_XYZ, lmslin);
}
function XYZ_to_IPT(xyz) {
    const lmslin = mat_vec_mul(IPT_XYZ_TO_LMS, xyz);
    const lms = lmslin.map(x => Math.pow(x, 0.43));
    return mat_vec_mul(IPT_LMS_TO_IPT, lms);
}
const IPT = {"to_xyz": IPT_to_XYZ, "from_xyz": XYZ_to_IPT};

const XYB_XYZ_TO_LMS = [
    [ 0.3739,  0.6896, -0.0413],
    [ 0.0792,  0.9286, -0.0035],
    [ 0.6212, -0.1027,  0.4704]
];
const XYB_LMS_TO_XYB = [
    [ 0.5, -0.5, 0.0],
    [ 0.5, 0.5, 0.0],
    [ 0.0, 0.0, 1.0],
]
const XYB_LMS_TO_XYZ = [
    [ 2.7253, -1.9993,  0.2245],
    [-0.2462,  1.2585, -0.0122],
    [-3.6527,  2.9148,  1.8268]
];
const XYB_XYB_TO_LMS = [
    [ 1.0, 1.0, 0.0],
    [ -1.0, 1.0, 0.0],
    [ 0.0, 0.0, 1.0],
]
const XYB_BIAS = 0.00379307;
const XYB_BIAS_CBRT = Math.cbrt(XYB_BIAS);
function XYB_to_XYZ(lab) {
    const lms = mat_vec_mul(XYB_XYB_TO_LMS, lab);
    const lmslin = lms.map(x => Math.pow(x + XYB_BIAS_CBRT, 3) - XYB_BIAS);
    return mat_vec_mul(XYB_LMS_TO_XYZ, lmslin);
}
function XYZ_to_XYB(xyz) {
    const lmslin = mat_vec_mul(XYB_XYZ_TO_LMS, xyz);
    const lms = lmslin.map(x => Math.cbrt(x + XYB_BIAS) - XYB_BIAS_CBRT);
    return mat_vec_mul(XYB_LMS_TO_XYB, lms);
}
const XYB = {"to_xyz": XYB_to_XYZ, "from_xyz": XYZ_to_XYB};

const LINEAR = {"to_xyz": x => x, "from_xyz": x => x};

// These are actually equivalent to the CIE curves and the code could be merged,
// but we're keeping closer to the sources.
function srlab2_f(t) {
    if (t < 216.0/24389.0) {
        return t * (24389.0 / 2700.0);
    } else {
        return 1.16 * Math.cbrt(t) - 0.16;
    }
}
function srlab2_f_inv(t) {
    if (t < 0.08) {
        return t * (2700.0 / 24389.0);
    } else {
        return Math.pow((t + 0.16) / 1.16, 3.0);
    }
}
const SRLAB2_XYZ_TO_LMS = [
    [ 0.424 ,  0.6933, -0.0884],
    [-0.2037,  1.1537,  0.0367],
    [-0.0008, -0.001 ,  0.9199]
];
const SRLAB2_LMS_TO_LAB = [
    [ 37.0950,   62.9054,   -0.0008],
    [663.4684, -750.5078,   87.0328],
    [ 63.9569,  108.4576, -172.4152],
];
const SRLAB2_LMS_TO_XYZ = [
    [ 1.8307, -1.1   ,  0.2198],
    [ 0.3231,  0.6726,  0.0042],
    [ 0.0019, -0.0002,  1.0873]
];
const SRLAB2_LAB_TO_LMS = [
    [0.01, +0.000904127, +0.000456344],
    [0.01, -0.000533159, -0.000269178],
    [0.01,  0.0        , -0.005800000]
];
function SRLAB2_to_XYZ(lab) {
    const lms = mat_vec_mul(SRLAB2_LAB_TO_LMS, lab);
    const lmslin = lms.map(srlab2_f_inv);
    return mat_vec_mul(SRLAB2_LMS_TO_XYZ, lmslin);
}
function XYZ_to_SRLAB2(xyz) {
    const lmslin = mat_vec_mul(SRLAB2_XYZ_TO_LMS, xyz);
    const lms = lmslin.map(srlab2_f);
    return mat_vec_mul(SRLAB2_LMS_TO_LAB, lms);
}
const SRLAB2 = {"to_xyz": SRLAB2_to_XYZ, "from_xyz": XYZ_to_SRLAB2};

function draw_gradient(id, c1, c2, cs, q) {
    const n_steps = Math.round(2.0 / (1 - Math.cbrt(q)));
    const a1 = cs["from_xyz"](sRGB_to_XYZ(c1));
    const a2 = cs["from_xyz"](sRGB_to_XYZ(c2));
    const element = document.getElementById(id);
    const w = element.width;
    const h = element.height;
    const ctx = element.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
        let t = x / (w - 1);
        if (q < 1) {
            t = Math.min(Math.floor(t * (n_steps + 1)) / n_steps, 1.0);
        }
        const a = lerp(a1, a2, t);
        const c = XYZ_to_sRGB(cs["to_xyz"](a));
        img.data[x * 4 + 0] = c[0];
        img.data[x * 4 + 1] = c[1];
        img.data[x * 4 + 2] = c[2];
        img.data[x * 4 + 3] = 255;
    }
    for (let y = 1; y < h; y++) {
        img.data.copyWithin(y * w * 4, 0, w * 4);
    }
    ctx.putImageData(img, 0, 0);
}

// UI
function getrgb(n) {
    return ['r', 'g', 'b'].map(c => {
        const v = document.getElementById(c + n).valueAsNumber;
        document.getElementById(c + 'o' + n).innerText = `${v}`;
        return v;
    });
}
function update(e) {
    rgb1 = getrgb(1);
    rgb2 = getrgb(2);
    q = document.getElementById('quant').valueAsNumber;
    draw_gradient("c0", rgb1, rgb2, SRGB, q);
    draw_gradient("c1", rgb1, rgb2, CIELAB, q);
    draw_gradient("c2", rgb1, rgb2, IPT, q);
    draw_gradient("c3", rgb1, rgb2, OKLAB, q);
    draw_gradient("c4", rgb1, rgb2, ICTCP, q);
    draw_gradient("c5", rgb1, rgb2, XYB, q);
    draw_gradient("c6", rgb1, rgb2, SRLAB2, q);
    draw_gradient("c7", rgb1, rgb2, LINEAR, q);
}
function setrgb(rgb1, rgb2) {
    for (let i = 0; i < 3; i++) {
        const c = ['r', 'g', 'b'][i];
        document.getElementById(c + 1).valueAsNumber = rgb1[i];
        document.getElementById(c + 2).valueAsNumber = rgb2[i];
    }
    update();
}
function randomize(e) {
    const rgb1 = [0, 1, 2].map(_ => Math.round(255 * Math.random()));
    const rgb2 = [0, 1, 2].map(_ => Math.round(255 * Math.random()));
    setrgb(rgb1, rgb2);
}
function install_ui() {
    for (var c of ['r', 'g', 'b']) {
        document.getElementById(c + 1).addEventListener('input', update);
        document.getElementById(c + 2).addEventListener('input', update);
    }
    document.getElementById('quant').addEventListener('input', update);
    document.getElementById('randomize').addEventListener('click', randomize);
    const colors = [
        [[0, 0, 255], [255, 255, 255]],
        [[0, 0, 0], [255, 255, 255]],
        [[0, 0, 17], [255, 255, 255]],
        [[0, 0, 255], [255, 255, 0]],
        [[255, 0, 0], [0, 0, 255]],
        [[255, 0, 0], [0, 255, 0]]
    ];
    for (var i = 0; i < colors.length; i++) {
        const c = colors[i];
        document.getElementById('q' + i).addEventListener('click', e => {
            setrgb(c[0], c[1]);
        });
    }
}
install_ui();
update();
</script>
