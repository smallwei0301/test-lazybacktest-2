// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "懶人回測Lazybacktest 撣貉???嚚?雿????舀",
  description: "?渡? 懶人回測Lazybacktest 雿輻??撣貉◤???9 ??憿??鞎餌????皞?箸撘蟡函???蝷曄黎???輯牧??,
}

const faqItems = [
  {
    id: "free",
    question: "懶人回測Lazybacktest ??摰?祥??",
    answer:
      "?舐?嚗azyBacktest ?敹??踝??葫撘????詨?I ?葫?蟡函????桀???祥???亙??典隞祥?脤???????蒂靽??Ｘ??祥?寞???,
  },
  {
    id: "coding",
    question: "?閬?蝔?閮剛???雿輻??",
    answer:
      "摰銝?閬???皜祈身摰?∠?耦???ｇ?頛詨?∠巨隞?Ⅳ????鈭斗?閬??喳摰????Ｖ????身蝭???蝷綽?撟怠蝚砌?甈⊥閫詨?皜祉??唳?敹恍???,
  },
  {
    id: "data",
    question: "鞈?靘???圈?隞暻潘?",
    answer:
      "?啗?寞靘?箇霅鈭斗????瑹葉敹?????蝟餌絞?? Netlify Functions ???瑕????祆??其漱???摰??湔嚗??啣??孵辣?脫?銋?典?皜祇??Ｘ???啜?,
  },
  {
    id: "future",
    question: "?葫蝯??臭誑靽??芯??脣??",
    answer:
      "?葫??風?脫?芋?祉??亥”?橘??⊥?靽??芯??脣?遣霅唳?蝮暹???嚗僑??研?憭批?瑼???嚗??箸捱蝑???銝行?◢?芰恣????璇辣??,
  },
  {
    id: "market",
    question: "?桀??舀?芯?撣????",
    answer:
      "?桀?銝餃??舀?啁銝?瑹蟡刻? ETF嚗蒂?? 20 撟港誑銝?甇瑕鞈????亦?蝢???賊?瘙??舫?撖縑??嚗???靘?瘙?隡唳?阡??整?,
  },
  {
    id: "batch",
    question: "?寥??芸???臭誑?獐?剁?",
    answer:
      "?寥??芸????憭??蝯?嚗?冽?箏????銵函頛末???乓????臭誑?冽??怠??矽?湔?隞塚?撱箄降??摰??敹??賂?靘??脣?湔?隞嗉???嚗??脖?甇交??,
  },
  {
    id: "export",
    question: "?葫?漱???隞亙?箏?嚗?,
    answer:
      "?典?皜祇??Ｗ???漱????臭?頛?CSV嚗靘踹???Excel ??Google 閰衣?銵具閬???航蟡剁??臬?????乓蟡函????Ｗ??臬?湧??梯”??,
  },
  {
    id: "records",
    question: "?∠巨蝝?????典鋆∴?????憭梧?",
    answer:
      "?∠巨蝝???脣??冽?汗?函??砍蝡荔?LocalStorage嚗?銝?銝?圈蝡胯遣霅啣???箏?隞踝??銝?鋆蔭?郊?蝙?典?亙??踝??踹?皜?汗?刻????箏仃??,
  },
  {
    id: "community",
    question: "蝷曄黎閮????踹?雿?雿?",
    answer:
      "蝷曄黎閮???鞎潭??神??Netlify Blobs ?脩垢?脣?嚗??蝙?刻?賜??唳??啁?閮???隢??梯???閬?嚗蒂?踹???隞颱?????鞈遣霅啜?,
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/faq" />
      <main>
        <section className="border-b bg-gradient-to-r from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              FAQ
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">撣貉???銝甈∠???/h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              ?扯??遢 FAQ ??嚗?臭誑敹恍?雿撠????賡?嚗蝙?冽?摮詻蟡函??冗蝢方?隢?撖縑?舀?賢摨??????
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <Link href="/guide" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                ???閫??摮?
              </Link>
              <Link href="/stock-records" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                ?渡????∠巨蝝??
              </Link>
              <Link href="/community" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                ?隞蝙?刻?隢?
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <Card className="mx-auto max-w-4xl border-border/60 shadow-sm">
            <CardContent className="px-4 py-6 md:px-8 md:py-10">
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="rounded-lg border border-border/60 px-4">
                    <AccordionTrigger className="text-left text-base font-semibold text-foreground">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-foreground">?鈭圾?游???</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                ?? FAQ 敺??臭誑蝜潛??梯?
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline"> ?梁??輻?</Link>
                ??
                <Link href="/disclaimer" className="text-primary underline-offset-4 hover:underline"> ?痊?脫?</Link>
                嚗閫????雿?霅瑁???雿輻蝭??????嚗迭餈?
                <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 撖縑蝯行?</Link>
                ??
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

