import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../interfaces/db_scheme";

export const supabase = new SupabaseClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY!,
);

export async function pushToDB(aiJsonOutput: any): Promise<any>{
  
  return new Promise(async (resolve, reject) => {
  
    const { data, error } = await supabase.from('prediction_ideas').insert({
      start:aiJsonOutput.start,
      end:aiJsonOutput.end,
      title:aiJsonOutput.title,
      resolving_rules: aiJsonOutput.description,
      answers: aiJsonOutput.answers,
      resolving_url: aiJsonOutput.resolving_url, // dunno if we have 
      slug:aiJsonOutput.slug
    })
    if (data) {
      resolve(data);
      console.log("sucess")
      return;
    }
    if (error) {
      reject(error);
      console.log("Error",error)
      return 
    }
    
  })
  



}