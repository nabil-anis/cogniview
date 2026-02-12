
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://alahfquavnqbkbmvycfv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsYWhmcXVhdm5xYmtibXZ5Y2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTI2NzMsImV4cCI6MjA4NjQ2ODY3M30.RhIK8FWpmjSyeF0gCNKl-uKiscwcCStC-AQ8BjBo9Iw';

export const supabase = createClient(supabaseUrl, supabaseKey);
