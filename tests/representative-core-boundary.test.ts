import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
// SHA-256 captured before Stage 1 edits, including the two pre-existing user changes.
const baseline = [
  {
    "path": "app/api/admin/impersonate/exit/route.ts",
    "hash": "BE6042D2F798BC3A43038C3A076BA936955C0D1F594E76A53CA2FC09A42F8A1F"
  },
  {
    "path": "app/api/admin/impersonate/route.ts",
    "hash": "44B47604675D71A5FF0F4CA81B28664B1B79AFA5FA9122F2A12A6E5DFCC934C9"
  },
  {
    "path": "app/api/admin/properties/[id]/charges/route.ts",
    "hash": "313F7AD1D652885C8815CF22622A3362D7C61BBBAEF1AE6F23F983E11D9BCB08"
  },
  {
    "path": "app/api/admin/properties/[id]/gplf/route.ts",
    "hash": "891D0B0C7B629D3E58B7239B36AAF1E5501EDDBF4423D530DFAF0C52D3EF2E8E"
  },
  {
    "path": "app/api/admin/properties/[id]/lifecycle/route.ts",
    "hash": "0A760E4D21E81CBF8A607A90044A9DAE1F0255E5BCCEE44C539C2A846BAF0760"
  },
  {
    "path": "app/api/admin/properties/[id]/management-users/reset-password/route.ts",
    "hash": "4DD86FFEDAB1B66D5AF2469478A2C6FF24BC128EAAC434346B82487C0550B03C"
  },
  {
    "path": "app/api/admin/properties/[id]/management-users/route.ts",
    "hash": "388383454654A223E27DE57EE04B26AB4FB284B1880C250BCCFF6BB2A8B1BA7D"
  },
  {
    "path": "app/api/admin/properties/[id]/management-users/support-list/route.ts",
    "hash": "B20B97A6E151CF9D09F58E62F0444F2D3E04894174C7D9309F78363D807CAB9C"
  },
  {
    "path": "app/api/admin/properties/[id]/override/route.ts",
    "hash": "5BA3F6CBCA1F3F19FC8DF19C7FE1012E2A5CBB21BC3898CE7ECBB0CF99224CD3"
  },
  {
    "path": "app/api/admin/properties/[id]/payment-status/route.ts",
    "hash": "2BC7A8F701F760599BA3DE0BD1B191439224549C3D959D38B21E6C78B9881A1C"
  },
  {
    "path": "app/api/admin/properties/[id]/route.ts",
    "hash": "5458F2B245B4E8C4DB2C6AC955B1B2899EEB3A55307E6A95E36D9C535F4D71B6"
  },
  {
    "path": "app/api/admin/properties/[id]/setup/route.ts",
    "hash": "EEDF5C5B3208E9F3913295F3DF33161BADC3E1E4F6F2A09D4A39D94EE107BA96"
  },
  {
    "path": "app/api/admin/properties/[id]/stripe-sync/route.ts",
    "hash": "3B0B23E3CE7734C3907B04CEFBF2D94809CFCBAAB383BA26BDD91E757ABF34CC"
  },
  {
    "path": "app/api/admin/properties/[id]/tiers/route.ts",
    "hash": "5E804D9E3358FD357049F410A489B7A7E502187D501FD4388A1F90FB78294794"
  },
  {
    "path": "app/api/admin/properties/[id]/units/route.ts",
    "hash": "2A01B558DAC881AD8DA4005F03E869A095EF2F2C6BB6C06EAFC10095065289FD"
  },
  {
    "path": "app/api/admin/properties/check-code/route.ts",
    "hash": "9A55B60365F34B07675062B9403DDBFAB9236AA266385742751ABA35A66FE318"
  },
  {
    "path": "app/api/admin/properties/list/route.ts",
    "hash": "C2D46937F77B5D24FA3E8C4FCDDC40AFD24DD080BD374A950902C193B22C4B52"
  },
  {
    "path": "app/api/admin/properties/page.module.css",
    "hash": "382F44C4F05B67E48B537160B2CE3C077A96CFDED9536C59CBE4FC5B7C9E3046"
  },
  {
    "path": "app/api/admin/properties/route.ts",
    "hash": "44FF1D59319F3C15A3C92B2E83D27BDF6410C380D8059011CDC7900CAF97CCC3"
  },
  {
    "path": "app/api/admin/property/set-status/route.ts",
    "hash": "DC07259B38FBB1E995ECA6015BCEEF64499C36CE2C1E3637CBEA2816B03AF219"
  },
  {
    "path": "app/api/admin/requests/[id]/route.ts",
    "hash": "39CDCE49C3840E1054D43D6E0663D6275A383843AFB6447012476E55D92A5EB6"
  },
  {
    "path": "app/api/admin/requests/list/route.ts",
    "hash": "EAEC20046D7FA87B4FC04658AC49381B99A6DEE79AF3CA76D838F99A364B8C95"
  },
  {
    "path": "app/api/admin/session/route.ts",
    "hash": "F23B06E32495D12D870CAE75AD49D25759DAC6EE02B360B916A360827D2D10DE"
  },
  {
    "path": "app/api/auth/resend-verification/route.ts",
    "hash": "EF515788BEFD588DE5779EC2D0F17B804C8F427536A83BB2B3C4D12B27AFA691"
  },
  {
    "path": "app/api/auth/session/route.ts",
    "hash": "0C13257B2B02A1F0D08C56BE9D95A8802654A2B2D3A7B59CE13710B82440C1C6"
  },
  {
    "path": "app/api/auth/verify-email/route.ts",
    "hash": "DC79FAA35DBBB7154EE31A81E183B3F1A22922BBB48D3CA9E9DA61714DF2CFCF"
  },
  {
    "path": "app/api/cron/late-fees/route.ts",
    "hash": "145E359F4D8C1783AF5AAB6115004C0F2AF4A62BF1C398FAFBED2565CB38E962"
  },
  {
    "path": "app/api/cron/monthly-rent/route.ts",
    "hash": "66EB0DD1507407025EA856B1217EB5BD87CE8E24F75401BEE262332757FED65A"
  },
  {
    "path": "app/api/exports/balances/route.ts",
    "hash": "E5E4FBA69DBF0259617DDA7323C9A6B9C6A2A293F6A4D18576EBBA7A55619234"
  },
  {
    "path": "app/api/exports/ledger/route.ts",
    "hash": "618D90763CF700EF3DE877FB6FC15168223325FA77EA24F186F1D73FDA5196E7"
  },
  {
    "path": "app/api/exports/payments/route.ts",
    "hash": "AB3110858F14DA9DA8D6021B43532C25B4782525052DD11BFA92630A65E693B1"
  },
  {
    "path": "app/api/ledger/adjust/route.ts",
    "hash": "68BB4D2C5626981D853A888A2FEEED9B05F946DD19BC0250C937892EDCC75F27"
  },
  {
    "path": "app/api/ledger/charges/route.ts",
    "hash": "01510CB1872E42A1B23EA487FA23A733A84EF833CB380DBE94DE6E5B59112930"
  },
  {
    "path": "app/api/ledger/post-recurring-fees/route.ts",
    "hash": "9BD1A5A5F4E13CEB4AA52CF92773EA0C54C1BCD861488F015A5DFE0BDD891B0B"
  },
  {
    "path": "app/api/ledger/post-rent/route.ts",
    "hash": "AAC121D57C9B7FC07CA71138497127D24578095530729D671221382BC224C319"
  },
  {
    "path": "app/api/maintenance/dashboard/route.ts",
    "hash": "72CEB9AB57CA66166376B08A27A43462E50276B17CE736CD3ED5F5D0EAFC81F8"
  },
  {
    "path": "app/api/maintenance/session/route.ts",
    "hash": "D60E0A83E8E956D8E604C1355AD59701E446B428C929652D670745BD06561099"
  },
  {
    "path": "app/api/manager/account/change-login/route.ts",
    "hash": "0E78871186E62DD370165410CC832E3BA230B58FFEB0CEBA24388C01458C0F6B"
  },
  {
    "path": "app/api/manager/audit-log/route.ts",
    "hash": "D706E64BCEFB002B25DECFD1A5086B94DEF9440671DB2EF7C74EC18DCADCDC5B"
  },
  {
    "path": "app/api/manager/dashboard/route.ts",
    "hash": "EB106389D65FF30D930CBA7511A32205BF896CD39C58FBD29808745C871B1929"
  },
  {
    "path": "app/api/manager/logout/route.ts",
    "hash": "AAC999D239BD5A91E448DA7A53B23B663A6032198533949AAE6C83E27E180EC0"
  },
  {
    "path": "app/api/manager/maintenance/pin/route.ts",
    "hash": "CDAD686C18E61B75889C1BCA31E6BBE28CBA8B4E0FFC3EA11456581F2E3D70CF"
  },
  {
    "path": "app/api/manager/maintenance/route.ts",
    "hash": "798DEB16B02C887132CE1E8F1EC0BC56A0754B5769206B11AC74A00AFA856572"
  },
  {
    "path": "app/api/manager/maintenance/update/route.ts",
    "hash": "D2DA97C6B93AB61C492A57D507167C75687EF69ABDB0562F2D0D8F6DAC9CBC31"
  },
  {
    "path": "app/api/manager/onboarding/property/route.ts",
    "hash": "525BF420D10FC8F370849020184ECE76CC69E1867155429EC5C23E38EDDB1D7F"
  },
  {
    "path": "app/api/manager/password-recovery/request/route.ts",
    "hash": "7285C43BC2359C3C89FBA2E4A97DE6C83902FA7CF628A38ED56338AD0E671BDA"
  },
  {
    "path": "app/api/manager/password-recovery/reset/route.ts",
    "hash": "B4DB72BFF2D3E7621E4F2E3EF8D7A4FB0EE74402A7F8E54F02A344073A67C6D0"
  },
  {
    "path": "app/api/manager/property/payment-status/route.ts",
    "hash": "CA7066A1E89B226AC9E59C536BCCD3F4624F6CF9B4799D0C2EE1459C42D5B95F"
  },
  {
    "path": "app/api/manager/property/qr/route.ts",
    "hash": "7A95A44AA64E32D07D39A0E7E1E0B82B1DBA36B7E11558CD0F11D3A1C6A7F2E0"
  },
  {
    "path": "app/api/manager/property/readiness/route.ts",
    "hash": "63A54308E69FB27E853E022B2A608502538C59E6610B4545D65D5D902524E573"
  },
  {
    "path": "app/api/manager/property/set-payment-status/route.ts",
    "hash": "9A5584BE9D4EA382A41488665A47D10F9DFFF16D3F7FC944213FBE9764530635"
  },
  {
    "path": "app/api/manager/property/unit-count/route.ts",
    "hash": "A1EFA677FB42D32220ADB71A858BC2586BF576704556A08552385D24B210ABF0"
  },
  {
    "path": "app/api/manager/proration/route.ts",
    "hash": "9B26910C62DC3EA8B9492F1F3142CF7BAA4191DD170EFF45E4E34149D1D49887"
  },
  {
    "path": "app/api/manager/remind/route.ts",
    "hash": "B32A5B843B65CA12A5606D0155A95404146EA71F3110C8AA031896C284C6F052"
  },
  {
    "path": "app/api/manager/retry/route.ts",
    "hash": "B32A5B843B65CA12A5606D0155A95404146EA71F3110C8AA031896C284C6F052"
  },
  {
    "path": "app/api/manager/session/route.ts",
    "hash": "5F79164347DAFCD5200D5A131784AEE0D63717BC74B3F385D9843F53DF24EC3B"
  },
  {
    "path": "app/api/manager/setup-complete/route.ts",
    "hash": "CE56AA298C7595D789437DDFB9A72E5B7CDC3E41ABD5DEB898CF3F228C14E136"
  },
  {
    "path": "app/api/manager/tenants/reset-pin/route.ts",
    "hash": "DC07259B38FBB1E995ECA6015BCEEF64499C36CE2C1E3637CBEA2816B03AF219"
  },
  {
    "path": "app/api/manager/units/delete/route.ts",
    "hash": "EB11C73B5BA81E45F732886B15D7645B0BCC1F9918807F13371DA38261D27C04"
  },
  {
    "path": "app/api/manager/units/inactive/route.ts",
    "hash": "B56E03EC57AD6F09CA3BBEDA894929172285BC4196C20DD329721E43E676B1BB"
  },
  {
    "path": "app/api/manager/units/move-tier/route.ts",
    "hash": "E61F65C974E2D7278B213393EB4F8AF3CCAE9ACD0C46A918E7885347168A359C"
  },
  {
    "path": "app/api/manager/units/toggle-active/route.ts",
    "hash": "BB486A606A1F59A7DCB98B4A17F989F88A0E2EC6A4F57DB8A2EEAA0B0057F734"
  },
  {
    "path": "app/api/manager/units/vacate/route.ts",
    "hash": "D72581B14FECE11B65EF7825702B2E8F6E50D7A503650DC0DEE01F7B46894C8E"
  },
  {
    "path": "app/api/manual-payments/route.ts",
    "hash": "BB32BC8AA8A474708390DCB68A449184C532CC0EE977EBC5727C36C19FF90884"
  },
  {
    "path": "app/api/notes/route.ts",
    "hash": "D90C7A7699D2CDC22A68C6650C542055E71B4C34A999759FD74AF401136C23ED"
  },
  {
    "path": "app/api/payments/create-session/route.ts",
    "hash": "EF61D9C72ACB715A0316E960B339292209F5DFC58C2F3F3F82F11750FA7E3808"
  },
  {
    "path": "app/api/property/resolve/route.ts",
    "hash": "5F85E2FF81686257B8BDAD60A6FC0A5102E29E964A5B64EEFB724357AEB201A7"
  },
  {
    "path": "app/api/public/property/lookup/route.ts",
    "hash": "FE35DAA353732230962D3C00DE8182A556047CEE1878E7BC57427FF0EDE88B80"
  },
  {
    "path": "app/api/public/stats/route.ts",
    "hash": "218B955FB46C661E4670324D5EFC2AAB784C27C301B20DB5EE7E4A3F79A9DC92"
  },
  {
    "path": "app/api/request-setup/route.ts",
    "hash": "298EE8ABED4937565394D2147BB5E6FAE7224D7C8BC72FC4DE0BD326204061F0"
  },
  {
    "path": "app/api/setup/route.ts",
    "hash": "FA8EC99DB3F45A97B55719076F168BE7C8C7855D7B83A8E0A5B90940E4EAE845"
  },
  {
    "path": "app/api/stream/route.ts",
    "hash": "52B40A7855A102F90D194AC95E11F316742AFC367DA1D9FD267D1845AA7BAC21"
  },
  {
    "path": "app/api/stripe/connect/route.ts",
    "hash": "62C9EFEFDF02886351A68BACAE2577D1C9B11006EF562759FF699295D16EB560"
  },
  {
    "path": "app/api/stripe/onboard/route.ts",
    "hash": "07F0137EF5F3D1DFFA25E63515B606C39397BA28318F1080D6E0F330BA487928"
  },
  {
    "path": "app/api/stripe/webhook/route.ts",
    "hash": "512686B8E0707772D3A82BB3EAAB48E5B35601564457FD23647A30D85297C37A"
  },
  {
    "path": "app/api/tenant/activate/route.ts",
    "hash": "E883B628DC1C9AEAB20B192E0399FE29AD0091E0790219D87012B3758DF36FED"
  },
  {
    "path": "app/api/tenant/balance/route.ts",
    "hash": "B226227BF6F07845F1E18037D0DC7D0D1BA22A37AB116ECE77C12A129B52549A"
  },
  {
    "path": "app/api/tenant/dashboard/route.ts",
    "hash": "1290DFF09A115D7F511F39E97DD23EEEE1096EFB90885D2E719D19D0FE2C335F"
  },
  {
    "path": "app/api/tenant/ledger/route.ts",
    "hash": "1048A0FEE53A2F7E0E8AF70D4FEF07F16D4E28B9912274EEE0815D1D89394A8B"
  },
  {
    "path": "app/api/tenant/maintenance/create/route.ts",
    "hash": "37EF29DD58F5298BAFE62B563848FD4B996E91842936C49AE418D45B2265E341"
  },
  {
    "path": "app/api/tenant/maintenance/list/route.ts",
    "hash": "552252F0973158FABC7C56B330AE0D5FE930FA3548CD006AB8D2780B79A1611B"
  },
  {
    "path": "app/api/tenant/maintenance/route.ts",
    "hash": "8FB170B47BB3E129BBF972C17E7BAC0C5095750469EC0D7B1F7BB1AA8692ADDC"
  },
  {
    "path": "app/api/tenant/me/route.ts",
    "hash": "FE51FCCE10C1D666DE444A82F16734F34A27E6B71BCC553B6C26F3F6F99220B9"
  },
  {
    "path": "app/api/tenant/payment-history/route.ts",
    "hash": "EDB233896808FB77DE115396428DB30E6D0ED1CD4B29C4D7B25A14AC8A4FD34A"
  },
  {
    "path": "app/api/tenant/payment-receipts/route.ts",
    "hash": "63A54308E69FB27E853E022B2A608502538C59E6610B4545D65D5D902524E573"
  },
  {
    "path": "app/api/tenant/session/route.ts",
    "hash": "1E718093947CAD0B7235589D11243B47295EAC24F63331E18B50F72C937800B1"
  },
  {
    "path": "app/api/test/load/manager-dashboard/route.ts",
    "hash": "1F77B6D5DCA1E2CA3F9AD7B6A14629B994DD05B962811D97ED79E875BD6921BB"
  },
  {
    "path": "app/api/test/load/monthly-rent-cron/route.ts",
    "hash": "875CD27A181E7A4942201E50EF5482E2ED3248DC30F1A470E1375D6ADBCAFF5B"
  },
  {
    "path": "app/api/test/load/payment-session-preflight/route.ts",
    "hash": "393C88716DCB4E1840B8731D7F699CB706FA81794D7145DCF575D5CC5C30D1A0"
  },
  {
    "path": "app/api/test/load/tenant-dashboard/route.ts",
    "hash": "38B8FFF0ED4A8D7AF20D286DEB19758C401277E49D42BE7592DBDFA64927C4E3"
  },
  {
    "path": "app/property-code/activate/page.tsx",
    "hash": "5FD7C611028B9664074482D2E1628898BCC3475056E6CC3EF0D108BC9F3165DE"
  },
  {
    "path": "app/property-code/activate/TenantActivateClient.tsx",
    "hash": "4A0373AD74FD3A3FA6591E66AB88EE2265E687470E70C4CA32F2AD70DAE48863"
  },
  {
    "path": "app/property-code/page.tsx",
    "hash": "BED9956E3E4CCF9079587BF84C689AB8166B4F1A96632B6FB94E9D625A5BB83F"
  },
  {
    "path": "app/property-code/role/page.tsx",
    "hash": "4D20C786D07A26DB4EFF56D4761F8937CBD60449D75A19204197C13EA0F66A86"
  },
  {
    "path": "app/property-code/role/RoleSelectClient.tsx",
    "hash": "7F9D3A00AF0858DF7BBD25DA0B5C4AC204E1C2E557EE02E43707537463D86E0E"
  },
  {
    "path": "app/tenant/activate/page.tsx",
    "hash": "B24405FBE554908D7DEDBE690E40C923A2285FEC7443CFEA0066656907EDB481"
  },
  {
    "path": "app/tenant/activate/TenantActivateClient.tsx",
    "hash": "2BCCC8918FEC1200E6A9D22644B8F17582FD4338EA52BD3571EF4413EAA16D13"
  },
  {
    "path": "app/tenant/balance/page.tsx",
    "hash": "7FCE911102CC2B2D3C1EA81FBC632AC7F9A7BB96F2C2961E3FC5DD15FDD62F73"
  },
  {
    "path": "app/tenant/dashboard/page.tsx",
    "hash": "50736D5FA1E5216DE7332D248B828A8BC140A58C8FFCB72BC28267E8A5CD1ADC"
  },
  {
    "path": "app/tenant/layout.tsx",
    "hash": "850A071F9BBCE58D87DC1914675CBBB2700C21C74DABC9B7AC95EF76104542C2"
  },
  {
    "path": "app/tenant/login/page.tsx",
    "hash": "674765FBCD2A2E7C9B513CBFCCEE998AD9345F03BB9631CB1C047A662A89522D"
  },
  {
    "path": "app/tenant/maintenance/page.tsx",
    "hash": "ECFAA3748067DBB7CA6472CE6F06CD0978415C4B170F1CEAC9A8CA06D6B40058"
  },
  {
    "path": "app/tenant/page.tsx",
    "hash": "3F6FD209FBBD24AC466311C3CEA43C3F47521A52CBE34ACF11ABD5E0C40BE141"
  },
  {
    "path": "app/tenant/pay/page.tsx",
    "hash": "7F89D741CDB7F70735C9A3C15E79560E16B87840937D715821E97893FF6224A1"
  },
  {
    "path": "app/tenant/payment-history/page.tsx",
    "hash": "0591FB53C9E63AFB327EB96657897822ED8BBB821A264E113AE0259E2B18DBB5"
  },
  {
    "path": "jobs/delinquency.ts",
    "hash": "63365077C155D363CFE0AFE3CD13DDB18ED64F31A8439AFF2448C2D4E8A796BD"
  },
  {
    "path": "jobs/lateFees.ts",
    "hash": "78BAB0DA75E0E2AAB845064FF9D94AD5F1A9A8DD5187FF381A59E79F9C573B5C"
  },
  {
    "path": "jobs/monthlyRent.ts",
    "hash": "82E4A3B92F936BEEF5D97B4442049FF4BB71A2FB0E6A4629A16B762198A08536"
  },
  {
    "path": "lib/allocatePayment.ts",
    "hash": "9A77B211A42F00F439E4A5D3101D149EF6F79F9BF0B85744CC4C886B5D43BC94"
  },
  {
    "path": "lib/authThrottle.ts",
    "hash": "0F8E2E7367617E92E23BA5C252E46231C3824879BF17076877E547319FED1648"
  },
  {
    "path": "lib/billingCalendar.ts",
    "hash": "A9A23CBA7E98D561ABF54726AC380613727E2B940D4BDBD732DF963243A984CA"
  },
  {
    "path": "lib/billingConfig.ts",
    "hash": "AE1353BA6E88C483CF0B1474A2FA5C0290535F915951FB1913D33BFFBCB1D045"
  },
  {
    "path": "lib/checkoutCollectibility.ts",
    "hash": "D825E9BA52B1F956E638145A59335A00D603DAC68A94463F7AD7C78D890540E8"
  },
  {
    "path": "lib/creatorReferrals.ts",
    "hash": "C1C030A4053EB571E971340274C58AE52A4C4E08D64BB2EED84CE959C3BCA2B1"
  },
  {
    "path": "lib/creatorSlugRules.ts",
    "hash": "9297A61973B9FB43048208406E6CC10942A3D42132287E69A2EE1DCE0970CADE"
  },
  {
    "path": "lib/dashboard.ts",
    "hash": "5A06CB2A6B68DFB1E6279C0C025E0F3EC609260B52BBFB92F723D27074468B57"
  },
  {
    "path": "lib/delinquency.ts",
    "hash": "94F1DE688C878378043765E11DD521529EB4A9FCABF30D30EA5D1441D732601E"
  },
  {
    "path": "lib/destructiveRetention.ts",
    "hash": "172D6D34E52C089901F57E8DBB8FEC69F6AA025379C638973E012177D66FB7D9"
  },
  {
    "path": "lib/email.ts",
    "hash": "64F016A761275902A7A59317D534A75E6A6570AD8FA3836BFCC3EBA0DCD008F3"
  },
  {
    "path": "lib/financialAccess.ts",
    "hash": "26A073B452791E746BB2AF2CF687172F77CE4596E4DBF3451EB7A99730638E86"
  },
  {
    "path": "lib/gracePeriod.ts",
    "hash": "7D35BA223BB846E4BF76485208AD6364500EB10EDE8CED6A61B5AF171B64DA8D"
  },
  {
    "path": "lib/lateFees.ts",
    "hash": "C86BE259AEEF5D8E6C4E1D9D91CCB51E7F33FFD30E48280D5DC7D86CE290D3D9"
  },
  {
    "path": "lib/ledger.ts",
    "hash": "7CBCBA6353150DF42973A94F500D63B71DBE1B5FE34813316E7EABEB270FA7DD"
  },
  {
    "path": "lib/liveGating.ts",
    "hash": "E17C12C2B2D9FC234090CA0866969B80FF836F825E07F9636977500B50F8C9AF"
  },
  {
    "path": "lib/managementAuth.ts",
    "hash": "0474FCBFF11C5EEACDDCDFF36766710C2278E8A06CB5D68E9353FE615BBCE700"
  },
  {
    "path": "lib/managementPasswordRecovery.ts",
    "hash": "7A156557036917DB03BB23BDE90AB098FC01D5A1FF1DA52EE0F0FCD9DD8C8D7E"
  },
  {
    "path": "lib/manualFinancialOperations.ts",
    "hash": "D0383C4522DA46E503271A0A78B49FDC2BAF977C62C79016093DA3D3A375A10D"
  },
  {
    "path": "lib/occupancy.ts",
    "hash": "BA0F2385797DE8B485B9C0F2E187918B35594DF3362592F21277D2AF51651FA5"
  },
  {
    "path": "lib/paymentAllocation.ts",
    "hash": "15534BF1981FF6EDEB38BF17BD600DCC78EC7483A319D61BE33CFEF0DDB80083"
  },
  {
    "path": "lib/paymentStatus.ts",
    "hash": "A972685AA4F9D974E591638FF6E55B5526C419D114C39EB0933D51284B240E9A"
  },
  {
    "path": "lib/permissions.ts",
    "hash": "D26D8F0516D687435FFD41D19A6853EBD4F9390B80DED0F7A5BEBA758C03ED74"
  },
  {
    "path": "lib/pin.ts",
    "hash": "176DB2DC56D32EDDB85C18CA8195E829E4CE74C17773A4407A87D4EB0C9294EF"
  },
  {
    "path": "lib/pinLockout.ts",
    "hash": "6BB980DA133D347B4FB692AFEED7BA9CC3E44C910F331D3C79BD309D0E9B12BC"
  },
  {
    "path": "lib/prisma.ts",
    "hash": "498AFE22B036080634F52C15C44667C1CCE6B19779005D3DB8BA0B7A450A3556"
  },
  {
    "path": "lib/propertyCapacity.ts",
    "hash": "9389F07E95B4670C8B18FB99621646A3061C7DEDCA3468F076C2B4D038747387"
  },
  {
    "path": "lib/propertyCode.ts",
    "hash": "9E373031659AEE71B037ABD534682D18B2AB5EFB42E3763298F530DF2AE08D7B"
  },
  {
    "path": "lib/propertySettings.ts",
    "hash": "3542335A01EF498C4A47514D629564669DB92085CAF320F32FB85D7A6E4BD9BB"
  },
  {
    "path": "lib/propertyStatus.ts",
    "hash": "711B1013F9D797947C7610DB943C681777BD0C5DEC8891BE4B274445F448E2F8"
  },
  {
    "path": "lib/proration.ts",
    "hash": "EE6E966FDEBD8FE943E622BC132A3E16A97EFCDBCB1E8641107C250A789952DD"
  },
  {
    "path": "lib/qr.ts",
    "hash": "4FDA3DCA17056792D588A4838919D62073292BCCF728B8C8D431AD7CF77CBF38"
  },
  {
    "path": "lib/rateLimit.ts",
    "hash": "2D06CCAA49A3DB601F1775DB44E5AE3F8E5D3F8F2AE8CB7DCA64A27459479CED"
  },
  {
    "path": "lib/realtime.ts",
    "hash": "5F13D236C756B81D01E18559D90CA07EAD129CC24CDF2273A445ED11E5D66830"
  },
  {
    "path": "lib/rentDates.ts",
    "hash": "76CC6693F16608C9144BF973712E21F556D12385711BB59A4349702F0358F1B6"
  },
  {
    "path": "lib/rentPreview.ts",
    "hash": "8179C92319A7DEACEE364EC4FCA9C6D24293B362710125A2822F7EA67C972D9A"
  },
  {
    "path": "lib/resend.ts",
    "hash": "429FC93D05562DCDE57CB44E54DE3E2C5D1D8F924D409C3DB54D70C84B5F5877"
  },
  {
    "path": "lib/session.ts",
    "hash": "14B346D66FB9584FA67189F67214C068331566E0513CB7514310096DF62F2CE0"
  },
  {
    "path": "lib/stats.ts",
    "hash": "3CD95C1C472F62CB2EBA422B3B6EA5C7B651C7E6EAFC1ECBE10879925F507FEA"
  },
  {
    "path": "lib/stripe.ts",
    "hash": "33DFBCEA95588694650A2FA7BDE9F9FB7A596C3B2AE136B249AD2AE4FDFA3B34"
  },
  {
    "path": "lib/stripeAccountStatus.ts",
    "hash": "344963D4F3D1948E9F7BDB591A3D930144FC38FB2D83112B22AF9FDA6AB2AC39"
  },
  {
    "path": "lib/unitFilters.ts",
    "hash": "1EAFBDB2B64E840AF001822A742E55B7D22D910D07C86491129B11BC31A0CBF3"
  },
  {
    "path": "lib/unitFinancialState.ts",
    "hash": "D59AE25DA3C9C9069727C1DE376CCB54F4E39CDA50BC8289AEAE6A757606B321"
  },
  {
    "path": "lib/unitStatusEngine.ts",
    "hash": "948F3E8DC77133AE96F5D0E30954804B0F3BCD6AD7B54446F7F7047A27B45F36"
  },
  {
    "path": "prisma/migrations/0_init/migration.sql",
    "hash": "C80196E6904B445DD4F73462E38E05F625F15339408FE83D56B882F74DC12CE3"
  },
  {
    "path": "prisma/migrations/20260806130000_harden_financial_uniqueness/migration.sql",
    "hash": "C950F47DF79B5FC78D2C61C7BFD4DFEA23BBB8C5E106A49C3A08569CCBDB5128"
  },
  {
    "path": "prisma/migrations/20260813100000_add_email_verification/migration.sql",
    "hash": "945D43454E984EEBACBBAC85CB2BB2E7BEF4A4205BAEB288AB203C619C322357"
  },
  {
    "path": "prisma/migrations/20260814101500_add_setup_complete_acknowledged_at/migration.sql",
    "hash": "A02679918F0DDC0D7AB1444E2C3A3148C7507A516772B6B5C4DA696BEA537679"
  },
  {
    "path": "prisma/migrations/20260914223000_add_ledger_idempotency_key/migration.sql",
    "hash": "77E8496BDC537D510039490BC3827983F9C5B22D92E17A2BA71936CA66039FF9"
  },
  {
    "path": "prisma/migrations/20261005000000_add_auth_throttle_bucket/migration.sql",
    "hash": "62315E7527242FC5DBC8A9125D013A96CE2F05F96250F1394BE808EE63421A47"
  },
  {
    "path": "prisma/migrations/20261006000000_bind_maintenance_request_assignment/migration.sql",
    "hash": "4BB5770E129FCD84061B5B306A37529A9F46CA2E6EF73538E1537015049B8229"
  },
  {
    "path": "prisma/migrations/20261006010000_add_tier_charge_effective_until/migration.sql",
    "hash": "735A41062B89BDE2F7525167C0261CECA53F35F58F26CFC1BD2B050CE073CA4C"
  },
  {
    "path": "prisma/migrations/20261007010000_add_creator_referrals/migration.sql",
    "hash": "77B4C7D51A273014EE8E51A639B20DB148D289CF68E97CBDDB67EBE3585D983C"
  },
  {
    "path": "prisma/migrations/20261012010000_add_management_password_reset_tokens/migration.sql",
    "hash": "71FFD0C20A0890B072EDA44B9859EAFA4BC55BCCBDBCB86B35ED16BB1129DAEF"
  },
  {
    "path": "scripts/check-new-accounts.ts",
    "hash": "69D2B97DECA690C9CBFDBC747F0B71603262BE09A5181D3E9BEF35FD740CF19D"
  },
  {
    "path": "tests/management-response-security.test.ts",
    "hash": "793B17947FD06FEB474E8516FD21314E1240ABE8DB45A77609D851D9DFBA114F"
  }
] as const;

test("all 164 protected/baseline files remain byte-identical", () => {
  assert.equal(baseline.length, 164);
  for (const entry of baseline) assert.equal(createHash("sha256").update(readFileSync(resolve(root, entry.path))).digest("hex").toUpperCase(), entry.hash, entry.path);
});

test("existing schema models/enums are unchanged; exactly four representative models appended", () => {
  const original = execFileSync("git", ["show", "34d386ff721e61acd331847c4354dd4dc7525013:prisma/schema.prisma"], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n").trimEnd();
  const current = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(current.slice(0, original.length), original);
  const added = current.slice(original.length);
  assert.deepEqual([...added.matchAll(/^model (\w+) \{/gm)].map(match => match[1]),
    ["Representative", "RepresentativeAgreement", "RepresentativeReferral", "RepresentativePayout"]);
  assert.doesNotMatch(added, /^enum /m);
  assert.doesNotMatch(added, /references: \[.*propertyId/);
  assert.doesNotMatch(added, /Property\??\s+@relation/);
});

test("migration only creates representative tables/indexes and their foreign keys", () => {
  const sql = readFileSync(resolve(root, "prisma/migrations/20261027010000_add_representative_program/migration.sql"), "utf8").replace(/--[^\n]*/g, "");
  const statements = sql.split(";").map(statement => statement.trim()).filter(Boolean);
  for (const statement of statements) assert.match(statement,
    /^(?:CREATE TABLE|CREATE (?:UNIQUE )?INDEX "[^"]+" ON|ALTER TABLE) "Representative(?:Agreement|Referral|Payout)?"[\s(]/);
  assert.equal(statements.filter(statement => statement.startsWith("CREATE TABLE")).length, 4);
  assert.doesNotMatch(sql, /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE TYPE)\b/i);
  assert.doesNotMatch(sql, /REFERENCES "Property"/);
});

test("creator application and reporting source remains unchanged", () => {
  for (const file of ["app/[creatorSlug]/route.ts", "scripts/create-creator.ts", "scripts/check-creator-referrals.ts"]) {
    const original = execFileSync("git", ["show", "34d386ff721e61acd331847c4354dd4dc7525013:" + file], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
    assert.equal(readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n"), original, file);
  }
});

