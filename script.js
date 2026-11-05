var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var MENU = [
  {
    c: "Seafood Flavors",
    i: [
      { n: "Takoyaki (Octopus)",   p: [55, 80, 150], u: ["octopus"] },
      { n: "Dried Shrimp",         p: [50, 80, 150], u: ["shrimp"] },
      { n: "Kaniyaki (Crabstick)", p: [50, 80, 150], u: ["crab"] }
    ]
  },
  {
    c: "Meaty Flavors",
    i: [
      { n: "Ham and Cheese",   p: [50, 80, 150], u: ["ham", "cheese"] },
      { n: "Bacon and Cheese", p: [50, 80, 150], u: ["bacon", "cheese"] },
      { n: "Cheese",           p: [50, 80, 150], u: ["cheese"] }
    ]
  },
  {
    c: "Veggie Flavors",
    i: [
      { n: "Mixed Veggies", p: [45, 75, 145], u: ["veggies"] }
    ]
  },
  {
    c: "Overload Flavors",
    i: [
      { n: "Seafood Overload", p: [65, 95, 170], u: ["octopus", "crab", "shrimp"] },
      { n: "Meaty Overload",   p: [60, 90, 160], u: ["ham", "bacon", "cheese"] }
    ]
  },
  {
    c: "Other Flavor",
    i: [
      { n: "CheeseBomb", p: [90, 120, 200], u: ["cheese"] }
    ]
  },
  {
    c: "Promo Bundle",
    i: [
      { n: "Jowa Bundle",    p: [95],  u: [], b: 2, t: "Choose 2 flavors" },
      { n: "Barkada Bundle", p: [150], u: [], b: 2, t: "Choose 2 flavors" },
      { n: "Family Bundle",  p: [220], u: [], b: 3, t: "Choose 3 flavors" }
    ]
  },
  {
    c: "Add-Ons",
    i: [
      { n: "Sauce",        p: [10], u: ["sauce"] },
      { n: "Kewpie",       p: [10], u: ["kewpie"] },
      { n: "Flakes",       p: [10], u: ["flakes"] },
      { n: "Floss",        p: [10], u: ["floss"] },
      { n: "Chilli Powder", p: [0],  u: ["chilli"] }
    ]
  }
];

var ING = [
  ["octopus", "Octopus"],
  ["crab",    "Crab Stick"],
  ["shrimp",  "Dried Shrimp"],
  ["ham",     "Ham"],
  ["bacon",   "Bacon"],
  ["cheese",  "Cheese"],
  ["veggies", "Mixed Veggies"],
  ["sauce",   "Sauce"],
  ["kewpie",  "Kewpie"],
  ["flakes",  "Flakes"],
  ["floss",   "Floss"],
  ["chilli",  "Chilli Powder"]
];

var FL = [
  ["Octopus",          ["octopus"],          "Seafood"],
  ["Crab",             ["crab"],             "Seafood"],
  ["Dried Shrimp",     ["shrimp"],           "Seafood"],
  ["Ham and Cheese",   ["ham", "cheese"],    "Meaty"],
  ["Bacon and Cheese", ["bacon", "cheese"],  "Meaty"],
  ["Cheese",           ["cheese"],           "Meaty"]
];

var LOW  = 15;
var MAXS = 100;

var VIEWS = [
  ["pos",       "POS",       "Point of Sale",  "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"],
  ["kitchen",   "Kitchen",   "Kitchen Orders", "M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z"],
  ["inventory", "Inventory", "Inventory",      "M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8"],
  ["sales",     "Sales",     "Sales Report",   "M4 20V10 M10 20V4 M16 20v-7 M22 20H2"]
];

var $ = function (s) {
  return document.querySelector(s);
};

var peso = function (n) {
  return "\u20B1" + Number(n).toLocaleString("en-PH");
};

function dk(d) {
  d = d || new Date();
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

function tm(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toast(m, bad) {
  var t = $("#toast");
  t.textContent = m;
  t.className = "on" + (bad ? " bad" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(function () {
    t.className = "";
  }, 2200);
}

function dbFail(e) {
  console.error(e);
  toast("Database error. Check your internet.", 1);
}

/* ---------- state (filled from Supabase) ---------- */

var inv = {};
ING.forEach(function (g) {
  inv[g[0]] = { name: g[1], stock: MAXS };
});

var orders = [];
var seq    = 1001;
var cart   = [];
var cat    = 0;
var cur    = "pos";
var sel    = dk();
var pend   = null;
var busy   = false;

/* ---------- load everything from the database ---------- */

async function loadAll() {
  var a = await db.from("ingredients").select("*");
  if (a.error) throw a.error;

  a.data.forEach(function (r) {
    inv[r.id] = { name: r.name, stock: r.stock };
  });

  var b = await db.from("orders").select("*, order_items(*)").order("ts", { ascending: true });
  if (b.error) throw b.error;

  orders = b.data.map(function (r) {
    var its = (r.order_items || []).slice().sort(function (x, y) {
      return x.id - y.id;
    });

    return {
      no: r.no,
      ts: Number(r.ts),
      date: r.date,
      by: r.staff,
      total: r.total,
      cash: r.cash,
      change: r.change_amt,
      st: r.status,
      items: its.map(function (i) {
        return { n: i.name, s: i.note || "", q: i.qty, price: i.price };
      })
    };
  });

  var maxNo = 0;
  orders.forEach(function (o) {
    if (o.no > maxNo) maxNo = o.no;
  });
  seq = Math.max(1001, maxNo + 1);
}

/* ---------- navigation ---------- */

function drawNav() {
  $("#nav").innerHTML = VIEWS.filter(function (v) {
    return allowed(v[0]);
  }).map(function (v) {
    var badge = "";
    if (v[0] === "kitchen") {
      var active = orders.filter(function (o) {
        return o.st !== "served";
      }).length;
      badge = '<span class="bd">' + active + '</span>';
    }

    return '<button class="' + (cur === v[0] ? "on" : "") + '" onclick="go(\'' + v[0] + '\')">' +
      '<svg viewBox="0 0 24 24"><path d="' + v[3] + '"/></svg>' +
      v[1] + badge +
      '</button>';
  }).join("");
}

function go(v) {
  // Hindi pwede ang view na ito sa role mo? Balik sa home page ng role
  if (!allowed(v)) v = home();

  cur = v;

  VIEWS.forEach(function (x) {
    $("#v-" + x[0]).classList.toggle("on", x[0] === v);
  });

  $("#ttl").textContent = VIEWS.filter(function (x) {
    return x[0] === v;
  })[0][2];

  drawNav();

  if (v === "kitchen")   drawKitchen();
  if (v === "inventory") drawInv();
  if (v === "sales")     drawSales();
}

function clock() {
  var date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  $("#clk").textContent = date + "  |  " + tm(Date.now());
}

/* ---------- menu ---------- */

function outOf(u) {
  for (var i = 0; i < u.length; i++) {
    if (inv[u[i]].stock < 1) return true;
  }
  return false;
}

function drawMenu() {
  $("#chips").innerHTML = MENU.map(function (m, i) {
    return '<button class="chip ' + (i === cat ? "on" : "") + '" onclick="cat=' + i + ';drawMenu()">' +
      m.c +
      '</button>';
  }).join("");

  $("#grid").innerHTML = MENU[cat].i.map(function (it, ii) {
    var off = outOf(it.u) ? " off" : "";

    var prices = it.p.map(function (p, pi) {
      var label = p === 0 ? "Free" : "Add";
      return '<button class="vb' + off + '" onclick="add(' + cat + ',' + ii + ',' + pi + ')">' +
        '<small>' + label + '</small>' +
        '<b>' + (p === 0 ? "FREE" : peso(p)) + '</b>' +
        '</button>';
    }).join("");

    var note = "";
    if (it.t)     note = '<p>' + it.t + '</p>';
    else if (off) note = '<p style="color:var(--rd)">Out of stock</p>';

    return '<div class="pc">' +
      '<h3>' + it.n + '</h3>' +
      note +
      '<div class="vs">' + prices + '</div>' +
      '</div>';
  }).join("");
}

/* ---------- cart ---------- */

function used(u) {
  return cart.reduce(function (a, l) {
    return a + l.u.filter(function (x) {
      return x === u;
    }).length * l.q;
  }, 0);
}

function lacking(u) {
  for (var i = 0; i < u.length; i++) {
    if (inv[u[i]].stock - used(u[i]) < 1) return inv[u[i]].name;
  }
  return null;
}

function total() {
  return cart.reduce(function (a, l) {
    return a + l.price * l.q;
  }, 0);
}

function addLine(it, pi, note, u) {
  var k = it.n + "|" + pi + "|" + note;

  var l = cart.filter(function (x) {
    return x.k === k;
  })[0];

  if (!l) {
    l = { k: k, n: it.n, s: note, price: it.p[pi], q: 0, u: u };
    cart.push(l);
  }

  l.q++;
  drawCart();
}

function add(ci, ii, pi) {
  var it = MENU[ci].i[ii];

  if (it.b) {
    openB(ci, ii, pi);
    return;
  }

  var m = lacking(it.u);
  if (m) {
    toast("Out of stock: " + m, 1);
    return;
  }

  addLine(it, pi, "", it.u);
}

function chg(i, d) {
  var l = cart[i];
  if (!l) return;

  if (d > 0) {
    var m = lacking(l.u);
    if (m) {
      toast("Out of stock: " + m, 1);
      return;
    }
  }

  l.q += d;
  if (l.q <= 0) cart.splice(i, 1);
  drawCart();
}

function clearCart() {
  cart = [];
  $("#cash").value = "";
  drawCart();
}

function drawCart() {
  $("#oTitle").textContent = "Order #" + seq;

  if (cart.length) {
    $("#lines").innerHTML = cart.map(function (l, i) {
      var amount = l.price * l.q === 0 ? "FREE" : peso(l.price * l.q);

      return '<div class="ln">' +
        '<div>' + l.n +
          '<small>' + (l.s ? l.s + '  |  ' : '') + peso(l.price) + ' each</small>' +
        '</div>' +
        '<div class="qt">' +
          '<button onclick="chg(' + i + ',-1)">-</button>' +
          '<b>' + l.q + '</b>' +
          '<button onclick="chg(' + i + ',1)">+</button>' +
        '</div>' +
        '<div class="amt">' + amount + '</div>' +
        '</div>';
    }).join("");
  } else {
    $("#lines").innerHTML = '<div class="em">No items yet.<br>Tap a price to add it to the order.</div>';
  }

  var L = $("#lines");
  L.scrollTop = L.scrollHeight;

  var t = total();
  $("#sub").textContent = peso(t);
  $("#tot").textContent = peso(t);

  var quick = [100, 200, 500, 1000];
  $("#qk").innerHTML =
    '<button onclick="setCash(' + t + ')">Exact</button>' +
    quick.map(function (v) {
      return '<button onclick="setCash(' + v + ')">' + v + '</button>';
    }).join("");

  pay();
}

function setCash(v) {
  $("#cash").value = v;
  pay();
}

function pay() {
  var t   = total();
  var raw = $("#cash").value;
  var c   = Number(raw);
  var b   = $("#go");
  var bx  = $("#chgBox");

  bx.classList.remove("sh");
  b.textContent = "Charge " + peso(t);

  if (!cart.length || raw === "") {
    $("#chgLab").textContent = "Change";
    $("#chg").textContent = peso(0);
    b.disabled = true;
  } else if (c < t) {
    $("#chgLab").textContent = "Still short";
    $("#chg").textContent = peso(t - c);
    bx.classList.add("sh");
    b.disabled = true;
  } else {
    $("#chgLab").textContent = "Change";
    $("#chg").textContent = peso(c - t);
    b.disabled = false;
  }
}

$("#cash").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !$("#go").disabled) checkout();
});

/* ---------- bundle picker ---------- */

var bp   = null;
var bsel = [];

function openB(ci, ii, pi) {
  bp = { ci: ci, ii: ii, pi: pi };
  bsel = [];
  drawB();
  $("#ovB").classList.add("on");
}

function drawB() {
  var it = MENU[bp.ci].i[bp.ii];

  $("#bTitle").textContent = it.n + " - Choose " + it.b + " flavors";

  var html = "";
  var lastGroup = "";

  FL.forEach(function (f, i) {
    if (f[2] !== lastGroup) {
      html += '<div class="fl">' + f[2] + '</div>';
      lastGroup = f[2];
    }

    var count = bsel.filter(function (x) {
      return x === i;
    }).length;
    var off = outOf(f[1]) ? " off" : "";

    html += '<button class="fb' + (count ? " sel" : "") + off + '" onclick="pickF(' + i + ')">' +
      f[0] +
      (count ? ' <span class="bd">x' + count + '</span>' : '') +
      '</button>';
  });

  $("#bFl").innerHTML = html;

  $("#bCnt").textContent = bsel.length + " / " + it.b + " chosen";
  $("#bOk").disabled = bsel.length !== it.b;
}

function pickF(i) {
  var it = MENU[bp.ci].i[bp.ii];

  if (bsel.length >= it.b) {
    toast("Complete na ang flavors", 1);
    return;
  }

  bsel.push(i);
  drawB();
}

function resetB() {
  bsel = [];
  drawB();
}

function closeB() {
  $("#ovB").classList.remove("on");
}

function confirmB() {
  var it = MENU[bp.ci].i[bp.ii];
  if (bsel.length !== it.b) return;

  var sorted = bsel.slice().sort(function (a, b) {
    return a - b;
  });

  var u = [];
  sorted.forEach(function (i) {
    u = u.concat(FL[i][1]);
  });

  var m = lacking(u);
  if (m) {
    toast("Out of stock: " + m, 1);
    return;
  }

  var note = sorted.map(function (i) {
    return FL[i][0];
  }).join(", ");

  addLine(it, bp.pi, note, u);
  closeB();
}

/* ---------- checkout ---------- */

function checkout() {
  var t = total();
  var c = Number($("#cash").value);

  if (!cart.length || c < t || $("#cash").value === "") return;

  c = Math.round(c);

  var items = cart.map(function (l) {
    return { n: l.n, s: l.s, q: l.q, price: l.price, u: l.u };
  });

  pend = {
    no: seq,
    ts: Date.now(),
    date: dk(),
    by: staffNow(),
    items: items,
    total: t,
    cash: c,
    change: c - t,
    st: "preparing"
  };

  $("#rNo").textContent = "Order #" + pend.no;

  $("#rLines").innerHTML = items.map(function (i) {
    var amount = i.price * i.q === 0 ? "FREE" : peso(i.price * i.q);
    var note = i.s
      ? '<div style="color:var(--mu);font-size:12px;margin:-6px 0 0 14px">' + i.s + '</div>'
      : '';

    return '<div class="li">' +
      '<span>' + i.q + ' x ' + i.n + '</span>' +
      '<span>' + amount + '</span>' +
      '</div>' + note;
  }).join("");

  $("#rTot").textContent  = peso(t);
  $("#rCash").textContent = peso(c);
  $("#rChg").textContent  = peso(c - t);

  $("#ov").classList.add("on");
}

/* Save the order to Supabase, then reduce the stock */
async function sendK() {
  if (!pend || busy) return;
  busy = true;

  try {
    var o = pend;

    // 1. make sure the order number is not used yet (other devices may have sold already)
    var mx = await db.from("orders").select("no").order("no", { ascending: false }).limit(1);
    if (mx.error) throw mx.error;
    if (mx.data.length && mx.data[0].no >= o.no) o.no = mx.data[0].no + 1;

    // 2. save the order
    var r1 = await db.from("orders").insert({
      no: o.no,
      ts: o.ts,
      date: o.date,
      staff: o.by,
      total: o.total,
      cash: o.cash,
      change_amt: o.change,
      status: o.st
    });
    if (r1.error) throw r1.error;

    // 3. save the items of the order
    var r2 = await db.from("order_items").insert(o.items.map(function (i) {
      return { order_no: o.no, name: i.n, note: i.s, qty: i.q, price: i.price };
    }));
    if (r2.error) throw r2.error;

    // 4. reduce the stock (read the latest stock first, then subtract)
    var dec = {};
    o.items.forEach(function (i) {
      i.u.forEach(function (u) {
        dec[u] = (dec[u] || 0) + i.q;
      });
    });

    for (var id in dec) {
      var g = await db.from("ingredients").select("stock").eq("id", id).single();
      var base = g.data ? g.data.stock : inv[id].stock;
      var left = Math.max(0, base - dec[id]);

      var up = await db.from("ingredients").update({ stock: left }).eq("id", id);
      if (up.error) throw up.error;

      inv[id].stock = left;
    }

    // 5. update the screen
    o.items = o.items.map(function (i) {
      return { n: i.n, s: i.s, q: i.q, price: i.price };
    });

    orders.push(o);
    seq = o.no + 1;
    pend = null;

    cart = [];
    $("#cash").value = "";

    closeR();
    drawCart();
    drawMenu();
    drawNav();
    drawToday();
    go("kitchen");

    toast("Order sent to the kitchen");
  } catch (e) {
    dbFail(e);
  } finally {
    busy = false;
  }
}

function closeR() {
  $("#ov").classList.remove("on");
}

/* ---------- kitchen ---------- */

function oCard(o, label, next) {
  var items = o.items.map(function (i) {
    return '<li>' + i.q + ' x ' + i.n + (i.s ? " (" + i.s + ")" : "") + '</li>';
  }).join("");

  return '<div class="oc">' +
    '<header>' +
      '<b>Order #' + o.no + '</b>' +
      '<span>' + tm(o.ts) + '</span>' +
    '</header>' +
    '<ul>' + items + '</ul>' +
    '<div class="ocf">' +
      '<b>' + peso(o.total) + '</b>' +
      '<button class="btn p sm" onclick="setSt(' + o.no + ',\'' + next + '\')">' + label + '</button>' +
    '</div>' +
    '</div>';
}

async function setSt(no, s) {
  try {
    var r = await db.from("orders").update({ status: s }).eq("no", no);
    if (r.error) throw r.error;

    orders.forEach(function (o) {
      if (o.no === no) o.st = s;
    });

    drawKitchen();
    drawNav();
  } catch (e) {
    dbFail(e);
  }
}

function drawKitchen() {
  var preparing = orders.filter(function (o) {
    return o.st === "preparing";
  });
  var ready = orders.filter(function (o) {
    return o.st === "ready";
  });

  $("#kPrep").innerHTML = preparing.length
    ? preparing.map(function (o) { return oCard(o, "Mark ready", "ready"); }).join("")
    : '<p class="em">No orders being prepared.</p>';

  $("#kReady").innerHTML = ready.length
    ? ready.map(function (o) { return oCard(o, "Mark served", "served"); }).join("")
    : '<p class="em">No orders waiting for pickup.</p>';
}

/* ---------- inventory ---------- */

function stat(s) {
  if (s < 1)    return ["out", "Out of stock"];
  if (s <= LOW) return ["low", "Low stock"];
  return ["ok", "In stock"];
}

async function saveStock(id) {
  var r = await db.from("ingredients").update({ stock: inv[id].stock }).eq("id", id);
  if (r.error) throw r.error;
}

async function adj(id, d) {
  try {
    inv[id].stock = Math.max(0, inv[id].stock + d);
    await saveStock(id);
    drawInv();
    drawMenu();
  } catch (e) {
    dbFail(e);
  }
}

async function setStock(id, v) {
  try {
    inv[id].stock = Math.max(0, Math.floor(Number(v) || 0));
    await saveStock(id);
    drawInv();
    drawMenu();
  } catch (e) {
    dbFail(e);
  }
}

function drawInv() {
  var ids = Object.keys(inv);
  var low = 0;
  var out = 0;

  ids.forEach(function (k) {
    var s = inv[k].stock;
    if (s < 1)        out++;
    else if (s <= LOW) low++;
  });

  $("#invK").innerHTML =
    '<div class="kpi"><span>Ingredients tracked</span><b>' + ids.length + '</b></div>' +
    '<div class="kpi"><span>Low stock</span><b>' + low + '</b></div>' +
    '<div class="kpi"><span>Out of stock</span><b style="color:var(--rd)">' + out + '</b></div>';

  $("#invT").innerHTML = ids.map(function (k) {
    var s  = inv[k].stock;
    var st = stat(s);

    return '<tr>' +
      '<td><b>' + inv[k].name + '</b></td>' +
      '<td><div class="lv ' + st[0] + '"><i style="width:' + Math.min(100, s / MAXS * 100) + '%"></i></div></td>' +
      '<td><span class="tag ' + st[0] + '">' + st[1] + '</span></td>' +
      '<td><input class="sk" type="number" min="0" value="' + s + '" onchange="setStock(\'' + k + '\',this.value)"></td>' +
      '<td class="num">' +
        '<button class="btn sm" onclick="adj(\'' + k + '\',-1)">-1</button> ' +
        '<button class="btn p sm" onclick="adj(\'' + k + '\',10)">+10</button> ' +
        '<button class="btn p sm" onclick="adj(\'' + k + '\',50)">+50</button>' +
      '</td>' +
      '</tr>';
  }).join("");
}

/* ---------- sales ---------- */

function dayTotal(d) {
  var s = 0;
  var n = 0;

  orders.forEach(function (o) {
    if (o.date === d) {
      s += o.total;
      n++;
    }
  });

  return { s: s, n: n };
}

function drawToday() {
  var t = dayTotal(dk());
  $("#tAmt").textContent = peso(t.s);
  $("#tOrd").textContent = t.n + (t.n === 1 ? " order" : " orders") + " today";
}

function drawSales() {
  $("#sd").value = sel;
  $("#dayTitle").textContent = "Orders on " + fmtDate(sel);

  var day = orders.filter(function (o) {
    return o.date === sel;
  }).sort(function (a, b) {
    return b.ts - a.ts;
  });

  var sum = 0;
  var cnt = 0;
  day.forEach(function (o) {
    sum += o.total;
    o.items.forEach(function (i) {
      cnt += i.q;
    });
  });

  $("#sK").innerHTML =
    '<div class="kpi"><span>Total sales</span><b>' + peso(sum) + '</b></div>' +
    '<div class="kpi"><span>Orders</span><b>' + day.length + '</b></div>' +
    '<div class="kpi"><span>Average order</span><b>' + peso(day.length ? Math.round(sum / day.length) : 0) + '</b></div>' +
    '<div class="kpi"><span>Items sold</span><b>' + cnt + '</b></div>';

  var base = new Date(sel + "T00:00:00");
  var days = [];
  var mx = 1;

  for (var i = 6; i >= 0; i--) {
    var d = new Date(base);
    d.setDate(d.getDate() - i);

    var k = dk(d);
    var t = dayTotal(k).s;
    if (t > mx) mx = t;

    days.push({
      k: k,
      t: t,
      l: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
    });
  }

  $("#bars").innerHTML = days.map(function (x) {
    return '<div class="bar ' + (x.k === sel ? "sel" : "") + '">' +
      '<em>' + (x.t ? peso(x.t) : "") + '</em>' +
      '<i style="height:' + Math.max(2, x.t / mx * 130) + 'px"></i>' +
      '<span>' + x.l + '</span>' +
      '</div>';
  }).join("");

  $("#sT").innerHTML = day.length
    ? day.map(function (o) {
        var items = o.items.map(function (i) {
          return i.q + ' x ' + i.n + (i.s ? " (" + i.s + ")" : "");
        }).join(", ");

        return '<tr>' +
          '<td><b>#' + o.no + '</b></td>' +
          '<td>' + tm(o.ts) + '</td>' +
          '<td>' + esc(o.by || "-") + '</td>' +
          '<td>' + items + '</td>' +
          '<td class="num"><b>' + peso(o.total) + '</b></td>' +
          '</tr>';
      }).join("")
    : '<tr><td colspan="5" style="color:var(--mu)">No orders on this date.</td></tr>';

  var agg = {};
  day.forEach(function (o) {
    o.items.forEach(function (i) {
      var a = agg[i.n] || (agg[i.n] = { q: 0, s: 0 });
      a.q += i.q;
      a.s += i.q * i.price;
    });
  });

  var names = Object.keys(agg).sort(function (a, b) {
    return agg[b].q - agg[a].q;
  }).slice(0, 6);

  var top = names.length ? agg[names[0]].q : 1;

  $("#top").innerHTML = names.length
    ? names.map(function (n) {
        return '<div class="tp">' +
          '<span>' + n + '</span>' +
          '<b>' + agg[n].q + ' sold  |  ' + peso(agg[n].s) + '</b>' +
          '<i style="width:' + agg[n].q / top * 100 + '%"></i>' +
          '</div>';
      }).join("")
    : '<p class="em">No sales yet.</p>';

  var staffAgg = {};
  day.forEach(function (o) {
    var n = o.by || "-";
    var a = staffAgg[n] || (staffAgg[n] = { n: 0, s: 0 });
    a.n++;
    a.s += o.total;
  });

  var staffNames = Object.keys(staffAgg).sort(function (a, b) {
    return staffAgg[b].s - staffAgg[a].s;
  });
  var staffMax = (staffNames.length ? staffAgg[staffNames[0]].s : 1) || 1;

  $("#byStaff").innerHTML = staffNames.length
    ? staffNames.map(function (n) {
        return '<div class="tp">' +
          '<span>' + esc(n) + '</span>' +
          '<b>' + staffAgg[n].n + (staffAgg[n].n === 1 ? ' order' : ' orders') + '  |  ' + peso(staffAgg[n].s) + '</b>' +
          '<i style="width:' + staffAgg[n].s / staffMax * 100 + '%"></i>' +
          '</div>';
      }).join("")
    : '<p class="em">No sales yet.</p>';

  var dateAgg = {};
  orders.forEach(function (o) {
    var a = dateAgg[o.date] || (dateAgg[o.date] = { n: 0, s: 0 });
    a.n++;
    a.s += o.total;
  });

  var dates = Object.keys(dateAgg).sort().reverse();

  $("#byDate").innerHTML = dates.length
    ? dates.map(function (d) {
        return '<div class="dr' + (d === sel ? ' sel' : '') + '" onclick="pickDate(\'' + d + '\')">' +
          '<span>' + fmtDate(d) + '</span>' +
          '<span>' + dateAgg[d].n + (dateAgg[d].n === 1 ? ' order' : ' orders') + '</span>' +
          '<b>' + peso(dateAgg[d].s) + '</b>' +
          '</div>';
      }).join("")
    : '<p class="em">No sales yet.</p>';
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function pickDate(d) {
  sel = d;
  drawSales();
  $("#v-sales").scrollTop = 0;
}

async function resetAll() {
  // Owner lang ang pwedeng mag-reset
  if (!isOwner()) {
    toast("Owner lang ang pwede dito", 1);
    return;
  }

  if (!confirm("Delete all orders, sales and inventory data? This cannot be undone.")) return;

  try {
    // deleting orders also deletes their order_items (on delete cascade)
    var r1 = await db.from("orders").delete().neq("no", 0);
    if (r1.error) throw r1.error;

    var r2 = await db.from("ingredients").update({ stock: MAXS }).neq("id", "");
    if (r2.error) throw r2.error;

    location.reload();
  } catch (e) {
    dbFail(e);
  }
}

/* ---------- helpers, export ---------- */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(name, text, type) {
  var blob = new Blob([text], { type: type });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 1000);
}

function csvCell(v) {
  v = String(v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function exportCSV() {
  if (!isOwner()) {
    toast("Owner lang ang pwede dito", 1);
    return;
  }

  if (!orders.length) {
    toast("No sales to export", 1);
    return;
  }

  var rows = [["Date", "Items", "Total"]];

  orders.slice().sort(function (a, b) {
    return a.ts - b.ts;
  }).forEach(function (o) {
    var items = o.items.map(function (i) {
      return i.q + " x " + i.n + (i.s ? " (" + i.s + ")" : "");
    }).join("; ");

    rows.push([o.date, items, o.total]);
  });

  var text = "\uFEFF" + rows.map(function (r) {
    return r.map(csvCell).join(",");
  }).join("\r\n");

  download("yummyyes-sales-" + dk() + ".csv", text, "text/csv;charset=utf-8");
  toast("Sales exported");
}

function exportBackup() {
  var data = {
    app: "yummyyes-pos",
    version: 1,
    exportedAt: new Date().toISOString(),
    seq: seq,
    inv: inv,
    orders: orders
  };

  download("yummyyes-backup-" + dk() + ".json", JSON.stringify(data), "application/json");
  toast("Backup saved");
}

function importBackup(file) {
  if (!file) return;

  var reader = new FileReader();

  reader.onload = async function () {
    var data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      toast("Invalid backup file", 1);
      return;
    }

    if (!data || !Array.isArray(data.orders)) {
      toast("Invalid backup file", 1);
      return;
    }

    var have = {};
    orders.forEach(function (o) {
      have[o.no] = true;
    });

    var fresh = data.orders.filter(function (o) {
      return o &&
        typeof o.no === "number" &&
        typeof o.ts === "number" &&
        typeof o.total === "number" &&
        typeof o.date === "string" &&
        Array.isArray(o.items) &&
        !have[o.no];
    });

    if (!fresh.length) {
      toast("Nothing new to import");
      return;
    }

    if (!confirm("Add " + fresh.length + " order(s) from this backup to the database?")) return;

    try {
      var latest = "";

      for (var n = 0; n < fresh.length; n++) {
        var o = fresh[n];

        var r1 = await db.from("orders").insert({
          no: o.no,
          ts: o.ts,
          date: o.date,
          staff: o.by || null,
          total: o.total,
          cash: o.cash || o.total,
          change_amt: o.change || 0,
          status: "served"
        });
        if (r1.error) throw r1.error;

        var r2 = await db.from("order_items").insert(o.items.map(function (i) {
          return { order_no: o.no, name: i.n, note: i.s || "", qty: i.q, price: i.price };
        }));
        if (r2.error) throw r2.error;

        if (o.date > latest) latest = o.date;
      }

      await loadAll();
      sel = latest;

      drawSales();
      drawToday();
      drawNav();
      drawMenu();
      drawCart();
      drawInv();

      toast("Imported " + fresh.length + " order(s) - " + fmtDate(latest));
    } catch (e) {
      dbFail(e);
    }
  };

  reader.readAsText(file);
}

/* ---------- keep all devices in sync ---------- */

async function poll() {
  if (!isAuthed() || document.hidden || busy || pend) return;
  if ($("#ovB").classList.contains("on")) return;

  try {
    var oldSeq = seq;
    await loadAll();

    drawNav();
    drawToday();
    drawMenu();

    if (seq !== oldSeq) drawCart();
    if (cur === "kitchen") drawKitchen();
    if (cur === "sales")   drawSales();

    var f = document.activeElement;
    if (cur === "inventory" && !(f && f.className === "sk")) drawInv();
  } catch (e) {
    console.error(e);
  }
}

/* ---------- startup ---------- */

async function init() {
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    toast("Cannot connect to the database", 1);
  }

  drawMenu();
  drawCart();
  drawToday();
  go("pos");
  clock();

  setInterval(clock, 30000);
  setInterval(poll, 8000);
}

/* ---------- staff login (PIN) ---------- */

var PIN = typeof STAFF_PIN !== "undefined" ? String(STAFF_PIN) : "1234";
var OPIN = typeof OWNER_PIN !== "undefined" ? String(OWNER_PIN) : "";
var NAMES = typeof STAFF_NAMES !== "undefined" && STAFF_NAMES.length ? STAFF_NAMES : [];
var AUTH_KEY = "yy2_auth";
var STAFF_KEY = "yy2_staff";
var ROLE_KEY = "yy2_role";
var pinBuf = "";
var pickedRole = "";
var tries = 0;
var lockUntil = 0;

function ss(k) {
  try {
    return sessionStorage.getItem(k) || "";
  } catch (e) {
    return "";
  }
}

function ssSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch (e) {}
}

function ssDel(k) {
  try {
    sessionStorage.removeItem(k);
  } catch (e) {}
}

function isAuthed() {
  return ss(AUTH_KEY) === "1";
}

function isOwner() {
  return ss(ROLE_KEY) === "owner";
}

// Owner: Inventory at Sales lang. Staff: POS, Kitchen, Inventory.
function allowed(v) {
  if (isOwner()) return v === "inventory" || v === "sales";
  return v === "pos" || v === "kitchen" || v === "inventory";
}

function home() {
  return isOwner() ? "sales" : "pos";
}

function staffNow() {
  if (isOwner()) return ss(STAFF_KEY) || "Owner";
  return ss(STAFF_KEY) || "Staff";
}

function drawStaff() {
  var label = "";
  if (isOwner()) {
    label = "Owner" + (ss(STAFF_KEY) ? " (" + ss(STAFF_KEY) + ")" : "");
  } else if (NAMES.length && ss(STAFF_KEY)) {
    label = "Cashier: " + ss(STAFF_KEY);
  }
  $("#curStaff").textContent = label;

  // Today's Sales: owner lang ang nakakakita
  $(".today").style.visibility = isOwner() ? "visible" : "hidden";
}

function currentPin() {
  return pickedRole === "owner" ? OPIN : PIN;
}

function drawPin() {
  var html = "";
  for (var i = 0; i < currentPin().length; i++) {
    html += '<i class="' + (i < pinBuf.length ? "f" : "") + '"></i>';
  }
  $("#dots").innerHTML = html;
}

function drawPad() {
  var keys = [
    ["1", "1"], ["2", "2"], ["3", "3"],
    ["4", "4"], ["5", "5"], ["6", "6"],
    ["7", "7"], ["8", "8"], ["9", "9"],
    ["clr", "C"], ["0", "0"], ["bk", "\u232B"]
  ];

  $("#pad").innerHTML = keys.map(function (k) {
    return '<button onclick="pinKey(\'' + k[0] + '\')">' + k[1] + '</button>';
  }).join("");
}

function pinKey(k) {
  if (Date.now() < lockUntil) return;

  if (k === "clr") {
    pinBuf = "";
  } else if (k === "bk") {
    pinBuf = pinBuf.slice(0, -1);
  } else if (pinBuf.length < currentPin().length) {
    pinBuf += k;
  }

  $("#lerr").textContent = "";
  drawPin();

  if (currentPin() && pinBuf.length === currentPin().length) checkPin();
}

function checkPin() {
  var role = "";
  if (pickedRole === "owner" && OPIN && pinBuf === OPIN) role = "owner";
  else if (pickedRole === "staff" && pinBuf === PIN) role = "staff";

  if (role) {
    ssSet(ROLE_KEY, role);
    tries = 0;
    pinBuf = "";
    ssSet(AUTH_KEY, "1");
    drawPin();
    afterPin();
    return;
  }

  tries++;
  pinBuf = "";

  var box = $(".lk");
  box.classList.remove("shake");
  void box.offsetWidth;
  box.classList.add("shake");

  if (tries >= 5) {
    tries = 0;
    lockUntil = Date.now() + 30000;
    $("#lerr").textContent = "Too many tries. Wait 30 seconds.";
    setTimeout(function () {
      $("#lerr").textContent = "";
    }, 30000);
  } else {
    $("#lerr").textContent = "Wrong PIN. Try again.";
  }

  drawPin();
}

function showRole() {
  pickedRole = "";
  pinBuf = "";
  $("#lerr").textContent = "";
  $(".lk").classList.add("pick");
  $("#lkTitle").textContent = "Who's logging in?";
  $("#who").innerHTML =
    '<button onclick="chooseRole(\'staff\')">Staff</button>' +
    '<button onclick="chooseRole(\'owner\')">Owner</button>';
  drawPin();
  $("#lock").classList.add("on");
}

function chooseRole(r) {
  pickedRole = r;
  pinBuf = "";
  $("#lerr").textContent = "";
  $(".lk").classList.remove("pick");
  $("#lkTitle").textContent = r === "owner" ? "Owner Login" : "Staff Login";
  drawPin();
}

function afterPin() {
  if (NAMES.length && !ss(STAFF_KEY)) showWho();
  else unlockApp();
}

function showWho() {
  $(".lk").classList.add("pick");
  $("#lkTitle").textContent = "Who's on duty?";
  $("#who").innerHTML = NAMES.map(function (n, i) {
    return '<button onclick="pickStaff(' + i + ')">' + esc(n) + '</button>';
  }).join("");
  $("#lock").classList.add("on");
}

function pickStaff(i) {
  ssSet(STAFF_KEY, NAMES[i]);
  unlockApp();
}

function unlockApp() {
  $(".lk").classList.remove("pick");
  $("#lock").classList.remove("on");
  drawStaff();
  drawNav();
  go(home());
}

function lockApp() {
  ssDel(AUTH_KEY);
  ssDel(STAFF_KEY);
  ssDel(ROLE_KEY);
  drawStaff();
  drawNav();
  go("pos");
  showRole();
}

document.addEventListener("keydown", function (e) {
  if (!$("#lock").classList.contains("on")) return;
  if ($(".lk").classList.contains("pick")) return;

  if (e.key >= "0" && e.key <= "9" && e.key.length === 1) pinKey(e.key);
  else if (e.key === "Backspace") pinKey("bk");
  else if (e.key === "Escape") pinKey("clr");
});

drawPad();
drawPin();
drawStaff();
if (isAuthed()) afterPin();
else showRole();

init();
