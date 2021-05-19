
document.onreadystatechange = () => {
    if (document.readyState === 'complete') {
      // document ready
      console.log("loaded");
      
      /*var table=new quicktable('#example');
      console.log(table)
      table.columns=['id','name','address','phone'];
      table.extractData();
      table.initDb();


      var table2=new quicktable('#example2');
      console.log(table2)
      table2.columns=['id','name','address','phone'];
      table2.extractData();
      table2.initDb();

      var table3=new quicktable('#example3');
      console.log(table3)
      table3.columns=['id','name','address','phone'];
      table3.extractData();
      table3.initDb();
      */
       //need create multiple db for smooth operation
   // 
   var table=new quicktable('#example');
  
      table.columns=['id','name','address','phone'];

      table.remember_type='test';
      //table.use_remember_type='test';
      //table.loadDb();

      fetch(base_url+'index.php/welcome/getData')
      .then(response => response.json())
      .then(data => {
        
        table.raw_data=data.data;
        let tbody=table.extractData();
        table.initDb();
      });

      /**
       * need encryption
       * --need pagination 
       * improve look
       * --sorting
       * to wroker
       * --allow multiple table sametime
       */
  
      
      
    }
}